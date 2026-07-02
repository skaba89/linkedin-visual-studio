/**
 * HERMÈS — useSystemStatus
 *
 * Hook that fetches real system status from the server, replacing the old
 * `useAgentSimulation` "play/pause/x1·x2·x4" simulation bar.
 *
 * Polls 3 endpoints every 30 seconds:
 *   1. /api/data/orchestrator — agent state + heartbeat rules + last activity
 *   2. /api/data/activity-logs?limit=8 — recent activity entries from DB
 *   3. /api/data/metrics — aggregate metrics (posts published, engagement…)
 *
 * Returns a stable shape that the DashboardView can render read-only:
 *   - agents with their real `status` (active | paused | error | setup)
 *   - lastRun / nextRun timestamps (parsed from orchestrator rules)
 *   - real activity logs from the server (not client-only Zustand)
 *   - real metrics from the DB
 *
 * This is what flips HERMÈS from "demo with a play button" to "real product
 * that runs via cron and reflects state in the UI".
 */
"use client";

import { useEffect, useState, useCallback } from "react";

export interface SystemAgent {
  id: string;
  num: string;
  name: string;
  role: string;
  status: "active" | "paused" | "error" | "setup";
  lastRun: string | null;
  nextRun: string | null;
}

export interface SystemActivityLog {
  id: string;
  agentId: string;
  agentName: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  details?: string;
  timestamp: string;
}

export interface SystemMetrics {
  postsPublished: number;
  tauxEngagement: number;
  leadsQualifies: number;
  rdvsGeneres: number;
  messagesEnvoyes: number;
  profilsCollectes: number;
}

export interface SystemStatus {
  /** Are agents actively running on the server (cron-driven)? */
  running: boolean;
  /** ISO timestamp of the last agent execution, or null if never. */
  lastActivityAt: string | null;
  /** Human-friendly "X min ago" relative to lastActivityAt. */
  lastActivityLabel: string;
  /** Active agents count (from orchestrator state). */
  activeAgentCount: number;
  agents: SystemAgent[];
  activityLogs: SystemActivityLog[];
  metrics: SystemMetrics;
  /** True while the initial fetch is in flight. */
  loading: boolean;
  /** Set if the most recent fetch failed — UI can show a "retry" banner. */
  error: string | null;
  /** Manually trigger a refetch (used after a user action). */
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds

function relativeTime(iso: string | null): string {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return `il y a ${Math.floor(diff / 86_400_000)} j`;
}

const DEFAULT_METRICS: SystemMetrics = {
  postsPublished: 0,
  tauxEngagement: 0,
  leadsQualifies: 0,
  rdvsGeneres: 0,
  messagesEnvoyes: 0,
  profilsCollectes: 0,
};

const AGENT_NAMES: Record<string, { num: string; name: string; role: string }> = {
  contenu:    { num: "01", name: "Contenu",     role: "Génération de posts LinkedIn" },
  qualification: { num: "02", name: "Qualification", role: "Scoring & enrichissement des leads" },
  prospection:{ num: "03", name: "Prospection", role: "Invitations & messages automatisés" },
  engagement: { num: "04", name: "Engagement",  role: "Likes & commentaires ciblés" },
  veille:     { num: "05", name: "Veille",      role: "Surveillance du marché & tendances" },
  nurturing:  { num: "06", name: "Nurturing",   role: "Suivi long-terme des leads tièdes" },
  analyse:    { num: "07", name: "Analyse",     role: "Performance & insights" },
  reseau:     { num: "08", name: "Réseau",      role: "Croissance & gestion du réseau" },
};

export function useSystemStatus(): SystemStatus {
  const [state, setState] = useState<{
    running: boolean;
    lastActivityAt: string | null;
    activeAgentCount: number;
    agents: SystemAgent[];
    activityLogs: SystemActivityLog[];
    metrics: SystemMetrics;
    loading: boolean;
    error: string | null;
  }>({
    running: false,
    lastActivityAt: null,
    activeAgentCount: 0,
    agents: [],
    activityLogs: [],
    metrics: DEFAULT_METRICS,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      // Fetch orchestrator state + activity logs + metrics in parallel
      const [orchRes, logsRes, metricsRes] = await Promise.allSettled([
        fetch("/api/data/orchestrator").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/activity-logs?limit=8").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/metrics").then((r) => r.ok ? r.json() : null),
      ]);

      // Orchestrator
      const orch = orchRes.status === "fulfilled" ? orchRes.value : null;
      const running = orch?.state === "running";
      const rules: Array<{ agentId: string; lastFiredAt?: string; nextRunAt?: string; enabled: boolean }> = orch?.rules ?? [];

      // Build agents list from rules (deduplicate by agentId)
      const agentMap = new Map<string, SystemAgent>();
      for (const rule of rules) {
        if (!rule.agentId) continue;
        const meta = AGENT_NAMES[rule.agentId] ?? { num: "??", name: rule.agentId, role: "" };
        if (!agentMap.has(rule.agentId)) {
          agentMap.set(rule.agentId, {
            id: rule.agentId,
            num: meta.num,
            name: meta.name,
            role: meta.role,
            status: rule.enabled ? "active" : "paused",
            lastRun: rule.lastFiredAt ?? null,
            nextRun: rule.nextRunAt ?? null,
          });
        }
      }

      // If no rules, fall back to the 8 default agents in "setup" state
      let agents = Array.from(agentMap.values());
      if (agents.length === 0) {
        agents = Object.entries(AGENT_NAMES).map(([id, meta]) => ({
          id,
          num: meta.num,
          name: meta.name,
          role: meta.role,
          status: "setup" as const,
          lastRun: null,
          nextRun: null,
        }));
      }

      const activeAgentCount = agents.filter((a) => a.status === "active").length;

      // Activity logs
      const logsData = logsRes.status === "fulfilled" ? logsRes.value : null;
      const logs: SystemActivityLog[] = (logsData?.logs ?? logsData?.activityLogs ?? []).map((l: Record<string, unknown>) => ({
        id: String(l.id ?? ""),
        agentId: String(l.agentId ?? ""),
        agentName: String(l.agentName ?? ""),
        type: (l.type as SystemActivityLog["type"]) ?? "info",
        message: String(l.message ?? ""),
        details: l.details ? String(l.details) : undefined,
        timestamp: l.timestamp instanceof Date
          ? (l.timestamp as Date).toISOString()
          : String(l.timestamp ?? new Date().toISOString()),
      }));

      const lastActivityAt = logs[0]?.timestamp ?? orch?.lastActivityAt ?? null;

      // Metrics
      const metricsData = metricsRes.status === "fulfilled" ? metricsRes.value : null;
      const metrics: SystemMetrics = metricsData
        ? {
            postsPublished: Number(metricsData.postsPublished ?? 0),
            tauxEngagement: Number(metricsData.tauxEngagement ?? 0),
            leadsQualifies: Number(metricsData.leadsQualifies ?? 0),
            rdvsGeneres: Number(metricsData.rdvsGeneres ?? 0),
            messagesEnvoyes: Number(metricsData.messagesEnvoyes ?? 0),
            profilsCollectes: Number(metricsData.profilsCollectes ?? 0),
          }
        : DEFAULT_METRICS;

      setState({
        running,
        lastActivityAt,
        activeAgentCount,
        agents,
        activityLogs: logs,
        metrics,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Échec du chargement",
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    ...state,
    lastActivityLabel: relativeTime(state.lastActivityAt),
    refresh,
  };
}
