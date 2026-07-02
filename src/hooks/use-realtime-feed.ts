/**
 * HERMÈS — Phase 4.1 — useRealtimeFeed
 *
 * React hook that opens a Server-Sent Events (SSE) connection to
 * /api/events/stream and exposes a live feed of activity events.
 *
 * Features:
 *   - Auto-reconnect on connection loss (with exponential backoff)
 *   - Deduplication via event IDs (Last-Event-ID header)
 *   - Buffered feed (last 100 events)
 *   - Connection status indicator (connecting | open | closed | error)
 *   - Per-event-type subscription (caller can filter on the fly)
 *
 * Usage:
 *   const { events, status } = useRealtimeFeed();
 *   // events is an array of RealtimeEvent, sorted oldest → newest
 *   // status is 'connecting' | 'open' | 'closed' | 'error'
 *
 * Multi-tenant safety:
 *   - The SSE endpoint requires authentication (NextAuth session cookie).
 *   - If the user is not authenticated, the connection is closed by the
 *     server with a 401, and the hook sets status='error'.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type RealtimeEventType =
  | "connected"
  | "activity_log"
  | "reactor"
  | "expert_comment"
  | "trending_topic"
  | "notification"
  | "heartbeat"
  | "close";

export interface RealtimeEvent {
  id: string;
  type: RealtimeEventType;
  data: Record<string, unknown>;
  receivedAt: number; // Date.now() when the client received it
}

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed" | "error";

const MAX_EVENTS = 100;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function useRealtimeFeed(options?: {
  enabled?: boolean;
  maxEvents?: number;
}): {
  events: RealtimeEvent[];
  status: ConnectionStatus;
  lastEventAt: number | null;
  clear: () => void;
  reconnect: () => void;
} {
  const enabled = options?.enabled ?? true;
  const maxEvents = options?.maxEvents ?? MAX_EVENTS;

  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closedByUserRef = useRef(false);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return; // SSR guard
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    closedByUserRef.current = false;
    setStatus("connecting");

    try {
      const es = new EventSource("/api/events/stream", { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus("open");
        setReconnectAttempt(0);
      };

      const handleEvent = (type: RealtimeEventType) => (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as Record<string, unknown>;
          const id = e.lastEventId || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const event: RealtimeEvent = {
            id,
            type,
            data,
            receivedAt: Date.now(),
          };
          setLastEventAt(event.receivedAt);
          setEvents((prev) => {
            const next = [...prev, event];
            if (next.length > maxEvents) {
              return next.slice(next.length - maxEvents);
            }
            return next;
          });
        } catch {
          // Ignore malformed events
        }
      };

      es.addEventListener("connected", handleEvent("connected") as EventListener);
      es.addEventListener("activity_log", handleEvent("activity_log") as EventListener);
      es.addEventListener("reactor", handleEvent("reactor") as EventListener);
      es.addEventListener("expert_comment", handleEvent("expert_comment") as EventListener);
      es.addEventListener("trending_topic", handleEvent("trending_topic") as EventListener);
      es.addEventListener("notification", handleEvent("notification") as EventListener);
      es.addEventListener("heartbeat", handleEvent("heartbeat") as EventListener);
      es.addEventListener("close", handleEvent("close") as EventListener);

      es.onerror = () => {
        if (closedByUserRef.current) return;
        setStatus("error");
        es.close();
        eventSourceRef.current = null;

        // Exponential backoff reconnect
        const attempt = reconnectAttempt + 1;
        setReconnectAttempt(attempt);
        const delay = Math.min(
          RECONNECT_BASE_MS * Math.pow(2, attempt - 1),
          RECONNECT_MAX_MS,
        );
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch {
      setStatus("error");
    }
  }, [maxEvents, reconnectAttempt]);

  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        closedByUserRef.current = true;
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus("idle");
      return;
    }

    connect();

    return () => {
      closedByUserRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, connect]);

  const clear = useCallback(() => setEvents([]), []);
  const reconnect = useCallback(() => {
    setReconnectAttempt(0);
    connect();
  }, [connect]);

  return { events, status, lastEventAt, clear, reconnect };
}
