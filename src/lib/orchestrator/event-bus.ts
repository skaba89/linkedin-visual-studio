// HERMÈS Event Bus — Central event system for agent orchestration
// Event history persisted to SQLite via Prisma

import { AgentEvent, AgentEventType } from "./types";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

type EventCallback = (event: AgentEvent) => void;
type AnyEventCallback = (event: AgentEvent) => void;

export class HermesEventBus {
  private listeners: Map<AgentEventType, Set<EventCallback>> = new Map();
  private anyListeners: Set<AnyEventCallback> = new Set();
  private userId = DEFAULT_USER_ID;

  on(eventType: AgentEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  once(eventType: AgentEventType, callback: EventCallback): () => void {
    const wrapper: EventCallback = (event) => {
      callback(event);
      this.listeners.get(eventType)?.delete(wrapper);
    };
    return this.on(eventType, wrapper);
  }

  onAny(callback: AnyEventCallback): () => void {
    this.anyListeners.add(callback);
    return () => {
      this.anyListeners.delete(callback);
    };
  }

  async emit(eventType: AgentEventType, event: Omit<AgentEvent, "type" | "id" | "timestamp">): Promise<AgentEvent> {
    const fullEvent: AgentEvent = {
      ...event,
      type: eventType,
      id: `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };

    // Persist to DB (fire-and-forget but we still await for reliability)
    try {
      await ensureDefaultUser();
      await db.eventHistory.create({
        data: {
          userId: this.userId,
          eventType,
          agentId: event.agentId,
          agentName: event.agentName,
          data: event.data ? JSON.stringify(event.data) : null,
        },
      });
    } catch (err) {
      console.error("[EventBus] Failed to persist event to DB:", err);
    }

    // Notify specific listeners (real-time dispatching)
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      for (const cb of listeners) {
        try {
          cb(fullEvent);
        } catch (err) {
          console.error(`[EventBus] Error in listener for ${eventType}:`, err);
        }
      }
    }

    // Notify any listeners
    for (const cb of this.anyListeners) {
      try {
        cb(fullEvent);
      } catch (err) {
        console.error(`[EventBus] Error in onAny listener:`, err);
      }
    }

    return fullEvent;
  }

  async emitEvent(
    eventType: AgentEventType,
    agentId: string,
    agentName: string,
    data?: Record<string, unknown>
  ): Promise<AgentEvent> {
    return this.emit(eventType, { agentId, agentName, data });
  }

  async getHistory(limit?: number): Promise<AgentEvent[]> {
    const rows = await db.eventHistory.findMany({
      where: { userId: this.userId },
      orderBy: { createdAt: "desc" },
      take: limit ?? 500,
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.eventType as AgentEventType,
      agentId: row.agentId,
      agentName: row.agentName,
      timestamp: row.createdAt,
      data: row.data ? JSON.parse(row.data) : undefined,
    }));
  }

  async clearHistory(): Promise<void> {
    await db.eventHistory.deleteMany({
      where: { userId: this.userId },
    });
  }

  removeAllListeners(): void {
    this.listeners.clear();
    this.anyListeners.clear();
  }
}

// Singleton
export const eventBus = new HermesEventBus();
