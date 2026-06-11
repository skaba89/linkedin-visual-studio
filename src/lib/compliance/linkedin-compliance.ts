// HERMÈS LinkedIn Compliance Manager — Rate limiting, warmup, mimicry

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

type LinkedInAction = "invitation" | "message" | "comment" | "like" | "profileView" | "post";

export class LinkedInComplianceManager {
  private level: ComplianceLevel = "moderate";
  private limits: LinkedInLimits;
  private warmupActive = false;
  private warmupStartDate?: Date;
  private usage: Record<LinkedInAction, number> = {
    invitation: 0,
    message: 0,
    comment: 0,
    like: 0,
    profileView: 0,
    post: 0,
  };
  private weeklyInvitations = 0;
  private lastResetDate = new Date().toDateString();
  private lastWeeklyReset = new Date().toDateString();
  private mimicryConfig: MimicryConfig = DEFAULT_MIMICRY;
  private violations: ComplianceViolation[] = [];

  constructor() {
    this.limits = { ...DEFAULT_LIMITS.moderate };
  }

  canPerformAction(action: LinkedInAction): { allowed: boolean; reason?: string } {
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

  recordAction(action: LinkedInAction): void {
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
  }

  async waitForMimicryDelay(): Promise<void> {
    const delay = this.getRandomDelay();
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  getStatus(): ComplianceStatus {
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

  startWarmup(): void {
    this.warmupActive = true;
    this.warmupStartDate = new Date();
    this.usage = { invitation: 0, message: 0, comment: 0, like: 0, profileView: 0, post: 0 };
  }

  getWarmupInfo(): { active: boolean; day: number; totalDays: number; config?: WarmupDayConfig } {
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

  setLevel(level: ComplianceLevel): void {
    this.level = level;
    this.limits = { ...DEFAULT_LIMITS[level] };
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
      this.usage = { invitation: 0, message: 0, comment: 0, like: 0, profileView: 0, post: 0 };
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
