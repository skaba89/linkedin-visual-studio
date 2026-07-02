/**
 * HERMÈS — Phase 4.1 — /api/events/stream
 *
 * Server-Sent Events (SSE) endpoint that pushes real-time activity events
 * to the authenticated user's browser. The client opens an EventSource
 * connection to this URL and receives a stream of events as they happen.
 *
 * Event types pushed:
 *   - activity_log    : new ActivityLog row (agent action, info/warning/error)
 *   - reactor         : new LinkedInReactor captured (like/comment on a post)
 *   - expert_comment  : new ExpertComment posted by the AI
 *   - trending_topic  : new TrendingTopic detected
 *   - notification    : new unread Notification
 *   - heartbeat       : keep-alive ping every 25s (prevents proxy timeout)
 *
 * Polling strategy:
 *   The endpoint polls the DB every 3s for new rows with createdAt > lastSeen.
 *   This is simpler than LISTEN/NOTIFY and works on all Postgres plans
 *   (including Render's free tier which doesn't expose LISTEN/NOTIFY).
 *
 * Connection lifecycle:
 *   - Client opens EventSource('/api/events/stream')
 *   - Server sends initial 'connected' event with the current server time
 *   - Server polls DB every 3s, sends events for new rows
 *   - Client closes connection → server detects req.signal abort → cleanup
 *   - Server sends heartbeat every 25s to keep the connection alive
 *
 * Multi-tenant safety:
 *   - requireUser() is called at the start; if not authenticated, returns 401
 *   - All DB queries are scoped by user.id
 *   - The SSE connection is per-user (no cross-user leaking)
 *
 * Render compatibility:
 *   - Render's free web service tier has a 100s connection timeout for
 *     non-WebSocket connections. SSE works because we send heartbeats
 *     every 25s, which keeps the connection active.
 *   - For Render's paid tier, the timeout is 300s (5 min), which is also
 *     covered by the 25s heartbeat.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger("events-stream");

const POLL_INTERVAL_MS = 3_000;
const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_CONNECTION_LIFETIME_MS = 55 * 60 * 1000; // 55 minutes (browsers auto-reconnect)

interface SseEvent {
  type: string;
  data: unknown;
  id?: string;
}

function formatSseEvent(event: SseEvent): string {
  const lines: string[] = [];
  if (event.id) lines.push(`id: ${event.id}`);
  lines.push(`event: ${event.type}`);
  lines.push(`data: ${JSON.stringify(event.data)}`);
  lines.push(""); // empty line terminates the event
  return lines.join("\n") + "\n";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  log.info("SSE connection opened", { userId });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Send initial 'connected' event
      safeEnqueue(
        formatSseEvent({
          type: "connected",
          data: { userId, serverTime: new Date().toISOString() },
        }),
      );

      // Track the last-seen timestamp for each event source
      const startTime = new Date();
      let lastActivityLogAt = startTime;
      let lastReactorAt = startTime;
      let lastExpertCommentAt = startTime;
      let lastTrendingTopicAt = startTime;
      let lastNotificationAt = startTime;

      // Polling loop
      const poll = async () => {
        if (closed) return;
        try {
          // 1. New activity logs
          const newLogs = await db.activityLog.findMany({
            where: { userId, createdAt: { gt: lastActivityLogAt } },
            orderBy: { createdAt: "asc" },
            take: 20,
          });
          for (const al of newLogs) {
            safeEnqueue(
              formatSseEvent({
                type: "activity_log",
                id: `al-${al.id}`,
                data: {
                  id: al.id,
                  agentId: al.agentId,
                  agentName: al.agentName,
                  type: al.type,
                  message: al.message,
                  details: al.details,
                  timestamp: al.createdAt.toISOString(),
                },
              }),
            );
            lastActivityLogAt = al.createdAt;
          }

          // 2. New reactors
          const newReactors = await db.linkedInReactor.findMany({
            where: { userId, capturedAt: { gt: lastReactorAt } },
            orderBy: { capturedAt: "asc" },
            take: 20,
            select: {
              id: true,
              postUrn: true,
              reactorName: true,
              reactorHeadline: true,
              action: true,
              commentText: true,
              capturedAt: true,
            },
          });
          for (const r of newReactors) {
            safeEnqueue(
              formatSseEvent({
                type: "reactor",
                id: `r-${r.id}`,
                data: {
                  id: r.id,
                  postUrn: r.postUrn,
                  reactorName: r.reactorName,
                  reactorHeadline: r.reactorHeadline,
                  action: r.action,
                  commentText: r.commentText,
                  capturedAt: r.capturedAt.toISOString(),
                },
              }),
            );
            lastReactorAt = r.capturedAt;
          }

          // 3. New expert comments
          const newComments = await db.expertComment.findMany({
            where: { userId, createdAt: { gt: lastExpertCommentAt } },
            orderBy: { createdAt: "asc" },
            take: 20,
            select: {
              id: true,
              source: true,
              targetPostUrn: true,
              commentText: true,
              tone: true,
              status: true,
              createdAt: true,
            },
          });
          for (const c of newComments) {
            safeEnqueue(
              formatSseEvent({
                type: "expert_comment",
                id: `ec-${c.id}`,
                data: {
                  id: c.id,
                  source: c.source,
                  targetPostUrn: c.targetPostUrn,
                  commentText: c.commentText,
                  tone: c.tone,
                  status: c.status,
                  createdAt: c.createdAt.toISOString(),
                },
              }),
            );
            lastExpertCommentAt = c.createdAt;
          }

          // 4. New trending topics
          const newTopics = await db.trendingTopic.findMany({
            where: { userId, detectedAt: { gt: lastTrendingTopicAt } },
            orderBy: { detectedAt: "asc" },
            take: 20,
            select: {
              id: true,
              topic: true,
              angle: true,
              heat: true,
              status: true,
              detectedAt: true,
            },
          });
          for (const t of newTopics) {
            safeEnqueue(
              formatSseEvent({
                type: "trending_topic",
                id: `tt-${t.id}`,
                data: {
                  id: t.id,
                  topic: t.topic,
                  angle: t.angle,
                  heat: t.heat,
                  status: t.status,
                  detectedAt: t.detectedAt.toISOString(),
                },
              }),
            );
            lastTrendingTopicAt = t.detectedAt;
          }

          // 5. New notifications
          const newNotifs = await db.notification.findMany({
            where: { userId, createdAt: { gt: lastNotificationAt } },
            orderBy: { createdAt: "asc" },
            take: 20,
            select: {
              id: true,
              title: true,
              message: true,
              category: true,
              priority: true,
              createdAt: true,
            },
          });
          for (const n of newNotifs) {
            safeEnqueue(
              formatSseEvent({
                type: "notification",
                id: `n-${n.id}`,
                data: {
                  id: n.id,
                  title: n.title,
                  message: n.message,
                  type: n.category, // map category → type for the client
                  priority: n.priority,
                  createdAt: n.createdAt.toISOString(),
                },
              }),
            );
            lastNotificationAt = n.createdAt;
          }
        } catch (err) {
          log.warn("SSE poll error (continuing)", {
            userId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      };

      // Heartbeat loop
      const heartbeat = () => {
        if (closed) return;
        safeEnqueue(
          formatSseEvent({
            type: "heartbeat",
            data: { timestamp: new Date().toISOString() },
          }),
        );
      };

      const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
      const heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
      const maxLifeTimer = setTimeout(() => {
        log.info("SSE connection reached max lifetime, closing", { userId });
        safeEnqueue(
          formatSseEvent({
            type: "close",
            data: { reason: "max_lifetime", reconnect: true },
          }),
        );
        controller.close();
        closed = true;
      }, MAX_CONNECTION_LIFETIME_MS);

      // Initial poll immediately (don't wait 3s for first event)
      poll().catch(() => {});

      // Cleanup on abort (client closed connection)
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        clearTimeout(maxLifeTimer);
        log.info("SSE connection closed by client", { userId });
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      // Stream cancelled by consumer
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable Nginx buffering (Render proxy)
    },
  });
}
