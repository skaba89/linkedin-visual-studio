// HERMÈS Agent Orchestrator — Coordinates agent execution and dependencies
// State persisted to SQLite via Prisma

import {
  AgentEvent,
  AgentEventType,
  AgentId,
  AGENT_IDS,
  AGENT_NAMES,
  OrchestratorState,
  OrchestratorMetrics,
  HeartbeatRule,
  Trigger,
  DEFAULT_DEPENDENCIES,
} from "./types";
import { eventBus } from "./event-bus";
import { parseAllHeartbeats, getRulesForEvent, getScheduleRules, getTriggerDelayMs } from "./heartbeat-parser";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

const DEFAULT_METRICS: OrchestratorMetrics = {
  totalEventsProcessed: 0,
  totalRulesFired: 0,
  averageProcessingTimeMs: 0,
  eventsByAgent: {},
  eventsByType: {},
  uptimeMs: 0,
};

export class AgentOrchestrator {
  private state: OrchestratorState = "stopped";
  private rules: HeartbeatRule[] = [];
  private startTime?: Date;
  private metrics: OrchestratorMetrics = { ...DEFAULT_METRICS };
  private intervalId?: ReturnType<typeof setInterval>;
  private userId: string = DEFAULT_USER_ID;
  private initialized = false;

  async initialize(userId: string = DEFAULT_USER_ID): Promise<void> {
    this.userId = userId;
    await ensureDefaultUser();

    // Load persisted state from DB
    const row = await db.orchestratorState.findUnique({
      where: { userId: this.userId },
    });

    if (row) {
      this.state = row.state as OrchestratorState;
      this.rules = (row.rules as HeartbeatRule[]) ?? [];
      this.startTime = row.startedAt ?? undefined;

      // Restore metrics if they were persisted
      if (row.metrics && row.metrics !== "{}") {
        try {
          const saved = (row.metrics as Partial<OrchestratorMetrics>) ?? {};
          this.metrics = {
            totalEventsProcessed: saved.totalEventsProcessed ?? 0,
            totalRulesFired: saved.totalRulesFired ?? 0,
            averageProcessingTimeMs: saved.averageProcessingTimeMs ?? 0,
            eventsByAgent: saved.eventsByAgent ?? {},
            eventsByType: saved.eventsByType ?? {},
            lastEventAt: saved.lastEventAt ? new Date(saved.lastEventAt) : undefined,
            uptimeMs: saved.uptimeMs ?? 0,
          };
        } catch {
          this.metrics = { ...DEFAULT_METRICS };
        }
      }
    } else {
      // No persisted state — parse default heartbeat rules
      this.rules = parseAllHeartbeats();
    }

    this.setupEventListeners();
    this.initialized = true;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /** Persist current orchestrator state to DB */
  private async saveState(): Promise<void> {
    await db.orchestratorState.upsert({
      where: { userId: this.userId },
      update: {
        state: this.state,
        rules: this.rules,
        startedAt: this.startTime ?? null,
        metrics: this.metrics,
      },
      create: {
        userId: this.userId,
        state: this.state,
        rules: this.rules,
        startedAt: this.startTime ?? null,
        metrics: this.metrics,
      },
    });
  }

  private setupEventListeners(): void {
    // Listen to all events and process rules
    eventBus.onAny((event) => {
      this.processAgentEvent(event);
    });
  }

  async start(): Promise<void> {
    await this.ensureLoaded();
    if (this.state === "running") return;
    this.state = "running";
    this.startTime = new Date();

    // Emit startup event
    await eventBus.emitEvent("system:startup", "system", "Système");

    // Start scheduler tick every minute
    this.intervalId = setInterval(() => {
      this.tickSchedule();
    }, 60000);

    // Also tick immediately
    this.tickSchedule();

    await this.saveState();
  }

  async stop(): Promise<void> {
    await this.ensureLoaded();
    if (this.state === "stopped") return;
    this.state = "stopped";

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    await eventBus.emitEvent("system:shutdown", "system", "Système");
    await this.saveState();
  }

  async pause(): Promise<void> {
    await this.ensureLoaded();
    if (this.state !== "running") return;
    this.state = "paused";
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    await this.saveState();
  }

  async resume(): Promise<void> {
    await this.ensureLoaded();
    if (this.state !== "paused") return;
    this.state = "running";
    this.intervalId = setInterval(() => {
      this.tickSchedule();
    }, 60000);
    await this.saveState();
  }

  async getState(): Promise<OrchestratorState> {
    await this.ensureLoaded();
    return this.state;
  }

  async getMetrics(): Promise<OrchestratorMetrics> {
    await this.ensureLoaded();
    const uptimeMs = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    return { ...this.metrics, uptimeMs };
  }

  async getRules(): Promise<HeartbeatRule[]> {
    await this.ensureLoaded();
    return [...this.rules];
  }

  async toggleRule(ruleId: string, enabled?: boolean): Promise<HeartbeatRule | undefined> {
    await this.ensureLoaded();
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) return undefined;
    rule.enabled = enabled ?? !rule.enabled;
    await this.saveState();
    return rule;
  }

  async runAgentNow(agentId: AgentId): Promise<void> {
    await this.ensureLoaded();
    const agentName = AGENT_NAMES[agentId] || agentId;
    const eventType = `${agentId}:post_published` as AgentEventType;

    // Find an appropriate event type for this agent
    const agentEventMap: Record<string, AgentEventType> = {
      contenu: "contenu:post_published",
      qualif: "qualif:leads_collected",
      prospection: "prospection:message_sent",
      engagement: "engagement:comment_posted",
      veille: "veille:briefing_generated",
      nurturing: "nurturing:action_sent",
      analyse: "analyse:report_generated",
      reseau: "reseau:invitation_sent",
    };

    const event = agentEventMap[agentId] || eventType;
    await eventBus.emitEvent(event, agentId, agentName, { manual: true });
  }

  processAgentEvent(event: AgentEvent): void {
    const processingStart = Date.now();

    // Update metrics
    this.metrics.totalEventsProcessed++;
    this.metrics.eventsByAgent[event.agentId] = (this.metrics.eventsByAgent[event.agentId] || 0) + 1;
    this.metrics.eventsByType[event.type] = (this.metrics.eventsByType[event.type] || 0) + 1;
    this.metrics.lastEventAt = new Date();

    // Find matching rules for this event
    const matchingRules = getRulesForEvent(event.type, this.rules);

    for (const rule of matchingRules) {
      if (!rule.enabled) continue;

      // Check delay triggers
      const delay = getTriggerDelayMs(rule.trigger);
      if (delay && delay > 0) {
        setTimeout(() => {
          this.fireRule(rule, event);
        }, delay);
      } else {
        this.fireRule(rule, event);
      }
    }

    // Update average processing time
    const processingTime = Date.now() - processingStart;
    const total = this.metrics.totalEventsProcessed;
    this.metrics.averageProcessingTimeMs =
      (this.metrics.averageProcessingTimeMs * (total - 1) + processingTime) / total;

    // Persist metrics in the background (non-blocking)
    this.saveState().catch((err) => {
      console.error("[Orchestrator] Failed to persist metrics:", err);
    });
  }

  private fireRule(rule: HeartbeatRule, _triggerEvent?: AgentEvent): void {
    rule.lastFiredAt = new Date();
    this.metrics.totalRulesFired++;

    // In a real system, this would execute the agent's task
    // For now, we emit an event that the rule was fired
    console.log(`[Orchestrator] Rule fired: ${rule.name} for agent ${rule.agentId}`);
  }

  private tickSchedule(): void {
    if (this.state !== "running") return;

    const now = new Date();
    const scheduleRules = getScheduleRules(this.rules);

    for (const rule of scheduleRules) {
      if (!rule.enabled) continue;
      // Simple check: if the rule hasn't been fired today and the cron matches
      if (rule.lastFiredAt) {
        const lastFired = new Date(rule.lastFiredAt);
        if (
          lastFired.getFullYear() === now.getFullYear() &&
          lastFired.getMonth() === now.getMonth() &&
          lastFired.getDate() === now.getDate()
        ) {
          continue; // Already fired today
        }
      }

      // For simplicity, we'll just fire the rule if it's a new day
      // In production, you'd use a proper cron parser
      this.fireRule(rule);
    }
  }
}

// Singleton
export const orchestrator = new AgentOrchestrator();
