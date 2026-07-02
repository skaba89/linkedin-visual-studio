"use client";

/**
 * HERMÈS — Phase 4.1 — RealtimeFeed
 *
 * Live activity feed powered by Server-Sent Events (SSE).
 * Shows a stream of everything happening in the user's HERMÈS account:
 *   - Agent activity logs (info, success, warning, error)
 *   - New reactors captured (likes + comments on LinkedIn posts)
 *   - AI expert comments posted
 *   - New trending topics detected
 *   - Notifications
 *
 * The feed is live — events appear within ~3 seconds of being recorded
 * in the database. No manual refresh required.
 *
 * Connection status indicator:
 *   - Green pulse dot: connected, receiving live events
 *   - Yellow pulse dot: connecting / reconnecting
 *   - Red dot: connection error (will auto-reconnect with backoff)
 *   - Gray dot: idle (feed disabled)
 *
 * Premium UX touches:
 *   - Each event animates in with a subtle fade+slide
 *   - Icons are color-coded by event type
 *   - Empty state shows a "waiting for activity" shimmer
 *   - "X new" indicator if feed is scrolled up
 *   - "Clear" button to reset the feed
 */

import { useRealtimeFeed, type RealtimeEvent } from "@/hooks/use-realtime-feed";
import {
  Activity,
  Heart,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Radio,
  Loader2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const EVENT_ICONS: Record<string, { icon: typeof Activity; color: string; bg: string; label: string }> = {
  activity_log: { icon: Activity, color: "text-[#00D4FF]", bg: "bg-[#00D4FF]/10", label: "Activité" },
  reactor: { icon: Heart, color: "text-[#E5263A]", bg: "bg-[#E5263A]/10", label: "Réacteur" },
  expert_comment: { icon: Sparkles, color: "text-[#A78BFA]", bg: "bg-[#A78BFA]/10", label: "Commentaire IA" },
  trending_topic: { icon: TrendingUp, color: "text-[#00C48C]", bg: "bg-[#00C48C]/10", label: "Tendance" },
  notification: { icon: Bell, color: "text-[#F4A100]", bg: "bg-[#F4A100]/10", label: "Notification" },
};

const LOG_TYPE_ICONS: Record<string, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

const LOG_TYPE_COLORS: Record<string, string> = {
  info: "text-[#00D4FF]",
  success: "text-[#00C48C]",
  warning: "text-[#F4A100]",
  error: "text-[#E5263A]",
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5_000) return "à l'instant";
  if (diff < 60_000) return `il y a ${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  return `il y a ${Math.floor(diff / 3_600_000)} h`;
}

function EventRow({ event }: { event: RealtimeEvent }) {
  const meta = EVENT_ICONS[event.type] ?? EVENT_ICONS.activity_log;
  const Icon = meta.icon;
  const data = event.data;

  let title = meta.label;
  let description = "";

  if (event.type === "activity_log") {
    const logType = (data.type as string) || "info";
    const LogIcon = LOG_TYPE_ICONS[logType] ?? Info;
    const logColor = LOG_TYPE_COLORS[logType] ?? "text-[#7B8A9A]";
    const agentName = (data.agentName as string) || "Système";
    const message = (data.message as string) || "";
    title = agentName;
    description = message;
    return (
      <div className="flex gap-2.5 px-3 py-2 hover:bg-white/[0.02] transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300">
        <div className={`w-7 h-7 rounded-md ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <LogIcon className={`w-3.5 h-3.5 ${logColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-medium text-[#F0F4F8] truncate">{title}</span>
            <span className="text-[10px] text-[#7B8A9A] flex-shrink-0">{relativeTime(event.receivedAt)}</span>
          </div>
          {description && (
            <p className="text-[11px] text-[#7B8A9A] mt-0.5 line-clamp-2 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
    );
  }

  if (event.type === "reactor") {
    const action = (data.action as string) || "like";
    const name = (data.reactorName as string) || "Quelqu'un";
    const headline = (data.reactorHeadline as string) || "";
    const ReactIcon = action === "comment" ? MessageCircle : Heart;
    title = name;
    description = action === "comment"
      ? `a commenté votre post${headline ? ` · ${headline}` : ""}`
      : `a aimé votre post${headline ? ` · ${headline}` : ""}`;
    return (
      <div className="flex gap-2.5 px-3 py-2 hover:bg-white/[0.02] transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300">
        <div className={`w-7 h-7 rounded-md ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <ReactIcon className={`w-3.5 h-3.5 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-medium text-[#F0F4F8] truncate">{title}</span>
            <span className="text-[10px] text-[#7B8A9A] flex-shrink-0">{relativeTime(event.receivedAt)}</span>
          </div>
          {description && (
            <p className="text-[11px] text-[#7B8A9A] mt-0.5 line-clamp-2 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
    );
  }

  if (event.type === "expert_comment") {
    const tone = (data.tone as string) || "expert";
    const status = (data.status as string) || "generated";
    const text = (data.commentText as string) || "";
    title = `Commentaire ${tone}`;
    description = status === "posted" ? `Publié: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}` : text.slice(0, 80);
  } else if (event.type === "trending_topic") {
    const topic = (data.topic as string) || "";
    const heat = (data.heat as string) || "warm";
    title = topic;
    description = `Sujet tendance (${heat})`;
  } else if (event.type === "notification") {
    title = (data.title as string) || "Notification";
    description = (data.message as string) || "";
  } else if (event.type === "connected") {
    title = "Connecté";
    description = "Flux temps réel actif";
  } else if (event.type === "heartbeat") {
    return null; // don't render heartbeats
  }

  return (
    <div className="flex gap-2.5 px-3 py-2 hover:bg-white/[0.02] transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className={`w-7 h-7 rounded-md ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-medium text-[#F0F4F8] truncate">{title}</span>
          <span className="text-[10px] text-[#7B8A9A] flex-shrink-0">{relativeTime(event.receivedAt)}</span>
        </div>
        {description && (
          <p className="text-[11px] text-[#7B8A9A] mt-0.5 line-clamp-2 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: "idle" | "connecting" | "open" | "closed" | "error" }) {
  const config = {
    idle: { color: "bg-[#7B8A9A]", pulse: false, label: "Inactif" },
    connecting: { color: "bg-[#F4A100]", pulse: true, label: "Connexion…" },
    open: { color: "bg-[#00C48C]", pulse: true, label: "En direct" },
    closed: { color: "bg-[#7B8A9A]", pulse: false, label: "Fermé" },
    error: { color: "bg-[#E5263A]", pulse: false, label: "Erreur" },
  }[status];

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${config.color} ${config.pulse ? "animate-pulse" : ""}`} />
      <span className="text-[10px] font-medium text-[#7B8A9A] uppercase tracking-wider">{config.label}</span>
    </div>
  );
}

export function RealtimeFeed({ maxHeight = "400px" }: { maxHeight?: string }) {
  const { events, status, clear, reconnect } = useRealtimeFeed();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [newCount, setNewCount] = useState(0);

  // Auto-scroll to bottom when new events arrive (only if user is at the bottom)
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else if (!autoScroll) {
      setNewCount((c) => c + 1);
    }
  }, [events, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
    if (isAtBottom) setNewCount(0);
  };

  const visibleEvents = events.filter((e) => e.type !== "heartbeat" && e.type !== "connected");

  return (
    <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#00D4FF]" />
          <span className="text-[12px] font-semibold text-[#F0F4F8]">Activité temps réel</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusIndicator status={status} />
          {status === "error" && (
            <button
              onClick={reconnect}
              className="text-[10px] text-[#00D4FF] hover:text-[#00D4FF]/80 transition-colors"
            >
              Reconnecter
            </button>
          )}
          <button
            onClick={clear}
            className="text-[#7B8A9A] hover:text-[#F0F4F8] transition-colors"
            title="Effacer le flux"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto flex-1 relative"
        style={{ maxHeight }}
      >
        {visibleEvents.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <Loader2 className="w-5 h-5 text-[#7B8A9A] animate-spin mx-auto mb-2" />
            <p className="text-[11px] text-[#7B8A9A]">
              En attente d&apos;activité…
            </p>
            <p className="text-[10px] text-[#7B8A9A]/60 mt-1">
              Les actions de vos agents apparaîtront ici en temps réel
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {visibleEvents
              .slice()
              .reverse() // newest at the bottom (auto-scroll target)
              .map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
          </div>
        )}
      </div>

      {/* "X new" indicator */}
      {!autoScroll && newCount > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            setNewCount(0);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="absolute left-1/2 -translate-x-1/2 bottom-2 bg-[#00D4FF] text-black text-[10px] font-semibold px-2 py-1 rounded-full shadow-lg hover:bg-[#00D4FF]/90 transition-colors"
        >
          {newCount} nouveau{newCount > 1 ? "x" : ""} ↓
        </button>
      )}
    </div>
  );
}

/**
 * Compact version for the dashboard sidebar / header.
 * Shows the last 5 events without scroll.
 */
export function RealtimeFeedCompact() {
  return <RealtimeFeed maxHeight="280px" />;
}
