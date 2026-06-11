// HERMÈS Agent Orchestrator — Coordinates agent execution and dependencies

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

export class AgentOrchestrator {
  private state: OrchestratorState = "stopped";
  private rules: HeartbeatRule[] = [];
  private startTime?: Date;
  private metrics: OrchestratorMetrics = {
    totalEventsProcessed: 0,
    totalRulesFired: 0,
    averageProcessingTimeMs: 0,
    eventsByAgent: {},
    eventsByType: {},
    uptimeMs: 0,
  };
  private intervalId?: ReturnType<typeof setInterval>;
  private userId: string = "default";

  async initialize(userId: string = "default"): Promise<void> {
    this.userId = userId;
    this.rules = parseAllHeartbeats();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen to all events and process rules
    eventBus.onAny((event) => {
      this.processAgentEvent(event);
    });
  }

  start(): void {
    if (this.state === "running") return;
    this.state = "running";
    this.startTime = new Date();

    // Emit startup event
    eventBus.emitEvent("system:startup", "system", "Système");

    // Start scheduler tick every minute
    this.intervalId = setInterval(() => {
      this.tickSchedule();
    }, 60000);

    // Also tick immediately
    this.tickSchedule();
  }

  stop(): void {
    if (this.state === "stopped") return;
    this.state = "stopped";

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    eventBus.emitEvent("system:shutdown", "system", "Système");
  }

  pause(): void {
    if (this.state !== "running") return;
    this.state = "paused";
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.state = "running";
    this.intervalId = setInterval(() => {
      this.tickSchedule();
    }, 60000);
  }

  getState(): OrchestratorState {
    return this.state;
  }

  getMetrics(): OrchestratorMetrics {
    const uptimeMs = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    return { ...this.metrics, uptimeMs };
  }

  getRules(): HeartbeatRule[] {
    return [...this.rules];
  }

  toggleRule(ruleId: string, enabled?: boolean): HeartbeatRule | undefined {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) return undefined;
    rule.enabled = enabled ?? !rule.enabled;
    return rule;
  }

  runAgentNow(agentId: AgentId): void {
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
    eventBus.emitEvent(event, agentId, agentName, { manual: true });
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
