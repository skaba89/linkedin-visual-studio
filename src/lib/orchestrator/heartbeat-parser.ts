// HERMÈS Heartbeat Parser — Parses YAML-like heartbeat rules

import { AgentEventType, HeartbeatRule, Trigger, DEFAULT_DEPENDENCIES } from "./types";

// Parse delay string like "2h", "30m", "1d" to milliseconds
export function parseDelay(delay: string): number {
  const match = delay.trim().match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "ms": return value;
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

// Parse a single agent's heartbeat markdown into rules
export function parseHeartbeat(agentId: string, heartbeatMd: string): HeartbeatRule[] {
  const rules: HeartbeatRule[] = [];
  const sections = heartbeatMd.split(/\n(?=\w)/);

  let ruleIndex = 0;
  for (const section of sections) {
    const lines = section.trim().split("\n");
    const nameLine = lines[0]?.trim();
    if (!nameLine) continue;

    const name = nameLine.replace(/:$/, "").trim();
    let trigger: Trigger | null = null;

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();

      // Parse schedule
      const scheduleMatch = trimmed.match(/^schedule:\s*["']?([^"']+)["']?/);
      if (scheduleMatch) {
        trigger = { type: "schedule", cron: scheduleMatch[1] };
        continue;
      }

      // Parse event trigger
      const triggerMatch = trimmed.match(/^trigger:\s*["']?([^"']+)["']?/);
      if (triggerMatch) {
        const eventStr = triggerMatch[1];
        // Parse "on_post_published" or "hermes_event:contenu-bot:post_published"
        const eventType = mapTriggerToEventType(eventStr);
        if (eventType) {
          trigger = { type: "event", eventType, sourceAgentId: agentId };
        }
        continue;
      }

      // Parse delay
      const delayMatch = trimmed.match(/^delay:\s*["']?([^"']+)["']?/);
      if (delayMatch && trigger && trigger.type === "event") {
        const delayMs = parseDelay(delayMatch[1]);
        trigger = { type: "delay", afterEvent: trigger.eventType, delayMs };
        continue;
      }
    }

    if (trigger) {
      rules.push({
        id: `${agentId}-${ruleIndex}`,
        agentId,
        name,
        trigger,
        enabled: true,
      });
      ruleIndex++;
    }
  }

  return rules;
}

// Map trigger strings to AgentEventType
function mapTriggerToEventType(triggerStr: string): AgentEventType | null {
  const mapping: Record<string, AgentEventType> = {
    "on_post_published": "contenu:post_published",
    "on_linkedin_reply": "prospection:reply_received",
    "on_no_reply:3d": "prospection:followup_needed",
    "on_no_reply:7d": "prospection:followup_needed",
    "hermes_event:contenu-bot:post_published": "contenu:post_published",
    "on_lead_qualified": "qualif:lead_qualified",
    "on_opportunity_detected": "veille:opportunity_detected",
  };

  return mapping[triggerStr] || null;
}

// Parse all default heartbeats
export function parseAllHeartbeats(): HeartbeatRule[] {
  const allRules: HeartbeatRule[] = [];

  const defaultHeartbeats: Record<string, string> = {
    contenu: `publish_daily_post:
  schedule:  "0 8 * * 1-5"
  task:      generate_linkedin_post

trigger_qualification_after_post:
  trigger:   "on_post_published"
  delay:     2h`,

    qualif: `collect_every_4h:
  schedule:  "0 */4 * * *"
  task:      qualify_leads

on_post_trigger:
  trigger:   "hermes_event:contenu-bot:post_published"
  delay:     2h`,

    prospection: `check_new_leads:
  schedule:  "0 */2 * * *"
  task:      send_initial_message

process_replies:
  trigger:   "on_linkedin_reply"
  task:      handle_replies

followup_j3:
  trigger:   "on_no_reply:3d"
  task:      send_followup_j3

followup_j7:
  trigger:   "on_no_reply:7d"
  task:      send_followup_j7`,

    engagement: `engage_daily:
  schedule:  "0 9,14 * * 1-5"
  task:      engage_with_icp

scan_morning_feed:
  schedule:  "0 8 * * 1-5"
  task:      scan_feed_and_identify_targets`,

    veille: `daily_briefing:
  schedule:  "0 7 * * 1-5"
  task:      market_intelligence

weekly_deep_dive:
  schedule:  "0 9 * * 1"
  task:      weekly_competitive_analysis`,

    nurturing: `nurture_leads:
  schedule:  "0 10 * * 1-5"
  task:      lead_nurturing

review_nurturing_pipeline:
  schedule:  "0 16 * * 5"
  task:      archive_cold_leads`,

    analyse: `weekly_analysis:
  schedule:  "0 17 * * 5"
  task:      performance_optimizer

mid_week_check:
  schedule:  "0 12 * * 3"
  task:      quick_performance_check`,

    reseau: `send_invitations:
  schedule:  "0 9 * * 1-5"
  task:      network_growth

check_acceptances:
  schedule:  "0 11 * * 1-5"
  task:      check_invitation_status`,
  };

  for (const [agentId, heartbeatMd] of Object.entries(defaultHeartbeats)) {
    allRules.push(...parseHeartbeat(agentId, heartbeatMd));
  }

  return allRules;
}

// Get rules that should fire for a given event
export function getRulesForEvent(eventType: AgentEventType, rules: HeartbeatRule[]): HeartbeatRule[] {
  return rules.filter((rule) => {
    if (rule.trigger.type === "event" && rule.trigger.eventType === eventType) {
      return true;
    }
    if (rule.trigger.type === "delay" && rule.trigger.afterEvent === eventType) {
      return true;
    }
    return false;
  });
}

// Get only schedule-based rules
export function getScheduleRules(rules: HeartbeatRule[]): HeartbeatRule[] {
  return rules.filter((rule) => rule.trigger.type === "schedule");
}

// Get the delay in ms for a trigger (0 for non-delay triggers)
export function getTriggerDelayMs(trigger: Trigger): number {
  if (trigger.type === "delay") {
    return trigger.delayMs;
  }
  return 0;
}
