// HERMÈS LinkedIn Compliance Manager — Rate limiting, warmup, mimicry
// Persisted to SQLite via Prisma

import {
  ComplianceLevel,
  ComplianceStatus,
  ComplianceViolation,
  LinkedInLimits,
  WarmupDayConfig,
  MimicryConfig,
  DEFAULT_LIMITS,
  WARMUP_SCHEDULE,
  DEFAULT_MIMICRY,
} from "./types";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

type LinkedInAction = "invitation" | "message" | "comment" | "like" | "profileView" | "post";

const DEFAULT_USAGE: Record<LinkedInAction, number> = {
  invitation: 0,
  message: 0,
  comment: 0,
  like: 0,
  profileView: 0,
  post: 0,
};

export class LinkedInComplianceManager {
  private level: ComplianceLevel = "moderate";
  private limits: LinkedInLimits;
  private warmupActive = false;
  private warmupStartDate?: Date;
  private usage: Record<LinkedInAction, number> = { ...DEFAULT_USAGE };
  private weeklyInvitations = 0;
  private lastResetDate = new Date().toDateString();
  private lastWeeklyReset = new Date().toDateString();
  private mimicryConfig: MimicryConfig = DEFAULT_MIMICRY;
  private violations: ComplianceViolation[] = [];
  private initialized = false;
  private userId = DEFAULT_USER_ID;

  constructor() {
    this.limits = { ...DEFAULT_LIMITS.moderate };
  }

  /** Load state from DB. Must be called before using the manager. */
  async initialize(): Promise<void> {
    await ensureDefaultUser();

    const row = await db.complianceState.findUnique({
      where: { userId: this.userId },
    });

    if (row) {
      this.level = row.level as ComplianceLevel;
      this.limits = { ...DEFAULT_LIMITS[this.level] };
      this.warmupActive = row.warmupActive;
      this.warmupStartDate = row.warmupStartDate ?? undefined;
      this.usage = JSON.parse(row.usage) as Record<LinkedInAction, number>;
      this.weeklyInvitations = row.weeklyInvitations;
      this.lastResetDate = row.lastResetDate;
      this.lastWeeklyReset = row.lastWeeklyReset;
      this.violations = JSON.parse(row.violations) as ComplianceViolation[];
      if (row.mimicryConfig && row.mimicryConfig !== "{}") {
        this.mimicryConfig = JSON.parse(row.mimicryConfig) as MimicryConfig;
      }
    }

    this.initialized = true;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /** Persist current in-memory state to DB */
  private async saveState(): Promise<void> {
    await db.complianceState.upsert({
      where: { userId: this.userId },
      update: {
        level: this.level,
        warmupActive: this.warmupActive,
        warmupStartDate: this.warmupStartDate ?? null,
        usage: JSON.stringify(this.usage),
        weeklyInvitations: this.weeklyInvitations,
        lastResetDate: this.lastResetDate,
        lastWeeklyReset: this.lastWeeklyReset,
        violations: JSON.stringify(this.violations),
        mimicryConfig: JSON.stringify(this.mimicryConfig),
      },
      create: {
        userId: this.userId,
        level: this.level,
        warmupActive: this.warmupActive,
        warmupStartDate: this.warmupStartDate ?? null,
        usage: JSON.stringify(this.usage),
        weeklyInvitations: this.weeklyInvitations,
        lastResetDate: this.lastResetDate,
        lastWeeklyReset: this.lastWeeklyReset,
        violations: JSON.stringify(this.violations),
        mimicryConfig: JSON.stringify(this.mimicryConfig),
      },
    });
  }

  async canPerformAction(action: LinkedInAction): Promise<{ allowed: boolean; reason?: string }> {
    await this.ensureLoaded();
    this.checkReset();

    const currentCount = this.usage[action];
    let limit: number;

    if (this.warmupActive) {
      const warmupLimits = this.getWarmupLimits();
      limit = warmupLimits[action];
    } else {
      limit = this.getLimitForAction(action);
    }

    if (currentCount >= limit) {
      return {
        allowed: false,
        reason: `Limite atteinte pour ${action}: ${currentCount}/${limit}`,
      };
    }

    // Check weekly invitation limit
    if (action === "invitation" && this.weeklyInvitations >= this.limits.weeklyInvitations) {
      return {
        allowed: false,
        reason: `Limite hebdomadaire atteinte pour les invitations: ${this.weeklyInvitations}/${this.limits.weeklyInvitations}`,
      };
    }

    return { allowed: true };
  }

  async recordAction(action: LinkedInAction): Promise<void> {
    await this.ensureLoaded();
    this.checkReset();
    this.usage[action]++;

    if (action === "invitation") {
      this.weeklyInvitations++;
    }

    // Check for violations
    const limit = this.warmupActive ? this.getWarmupLimits()[action] : this.getLimitForAction(action);
    if (this.usage[action] > limit * 0.8) {
      this.violations.push({
        type: "warning",
        category: action,
        message: `Approche de la limite pour ${action}: ${this.usage[action]}/${limit}`,
        current: this.usage[action],
        limit,
        timestamp: new Date(),
      });
    }

    await this.saveState();
  }

  async waitForMimicryDelay(): Promise<void> {
    const delay = this.getRandomDelay();
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async getStatus(): Promise<ComplianceStatus> {
    await this.ensureLoaded();
    this.checkReset();
    return {
      level: this.level,
      isWarmupActive: this.warmupActive,
      warmupDay: this.getWarmupDay(),
      currentLimits: this.limits,
      usage: {
        invitationsToday: this.usage.invitation,
        messagesToday: this.usage.message,
        commentsToday: this.usage.comment,
        likesToday: this.usage.like,
        postsToday: this.usage.post,
      },
      violations: [...this.violations],
    };
  }

  async startWarmup(): Promise<void> {
    await this.ensureLoaded();
    this.warmupActive = true;
    this.warmupStartDate = new Date();
    this.usage = { ...DEFAULT_USAGE };
    await this.saveState();
  }

  async getWarmupInfo(): Promise<{ active: boolean; day: number; totalDays: number; config?: WarmupDayConfig }> {
    await this.ensureLoaded();
    if (!this.warmupActive) {
      return { active: false, day: 0, totalDays: 14 };
    }

    const day = this.getWarmupDay();
    return {
      active: true,
      day,
      totalDays: 14,
      config: WARMUP_SCHEDULE[Math.min(day - 1, 13)],
    };
  }

  async setLevel(level: ComplianceLevel): Promise<void> {
    await this.ensureLoaded();
    this.level = level;
    this.limits = { ...DEFAULT_LIMITS[level] };
    await this.saveState();
  }

  private getLimitForAction(action: LinkedInAction): number {
    const mapping: Record<LinkedInAction, keyof LinkedInLimits> = {
      invitation: "dailyInvitations",
      message: "dailyMessages",
      comment: "dailyComments",
      like: "dailyLikes",
      profileView: "dailyProfileViews",
      post: "dailyPosts",
    };
    return this.limits[mapping[action]];
  }

  private getWarmupLimits(): Record<LinkedInAction, number> {
    const day = this.getWarmupDay();
    const config = WARMUP_SCHEDULE[Math.min(day - 1, 13)];
    return {
      invitation: config.invitations,
      message: config.messages,
      comment: config.comments,
      like: config.likes,
      profileView: config.profileViews,
      post: config.posts,
    };
  }

  private getWarmupDay(): number {
    if (!this.warmupStartDate) return 0;
    const diff = Date.now() - this.warmupStartDate.getTime();
    return Math.min(Math.floor(diff / (24 * 60 * 60 * 1000)) + 1, 14);
  }

  private checkReset(): void {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.usage = { ...DEFAULT_USAGE };
      this.lastResetDate = today;
      this.violations = [];
    }

    // Weekly reset (simple check: different week)
    const now = new Date();
    const lastReset = new Date(this.lastWeeklyReset);
    if (now.getDay() === 1 && now.toDateString() !== this.lastWeeklyReset) {
      // Monday reset
      this.weeklyInvitations = 0;
      this.lastWeeklyReset = today;
    }
  }

  private getRandomDelay(): number {
    const { minDelayBetweenActionsMs, maxDelayBetweenActionsMs } = this.mimicryConfig;
    return Math.floor(Math.random() * (maxDelayBetweenActionsMs - minDelayBetweenActionsMs)) + minDelayBetweenActionsMs;
  }
}

// Singleton
export const linkedInCompliance = new LinkedInComplianceManager();
