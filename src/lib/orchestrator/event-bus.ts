// HERMÈS Event Bus — Central event system for agent orchestration

import { AgentEvent, AgentEventType } from "./types";

type EventCallback = (event: AgentEvent) => void;
type AnyEventCallback = (event: AgentEvent) => void;

export class HermesEventBus {
  private listeners: Map<AgentEventType, Set<EventCallback>> = new Map();
  private anyListeners: Set<AnyEventCallback> = new Set();
  private history: AgentEvent[] = [];
  private maxHistory = 500;

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

  emit(eventType: AgentEventType, event: Omit<AgentEvent, "type" | "id" | "timestamp">): AgentEvent {
    const fullEvent: AgentEvent = {
      ...event,
      type: eventType,
      id: `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };

    // Store in history
    this.history.unshift(fullEvent);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }

    // Notify specific listeners
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

  emitEvent(
    eventType: AgentEventType,
    agentId: string,
    agentName: string,
    data?: Record<string, unknown>
  ): AgentEvent {
    return this.emit(eventType, { agentId, agentName, data });
  }

  getHistory(limit?: number): AgentEvent[] {
    return limit ? this.history.slice(0, limit) : [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  removeAllListeners(): void {
    this.listeners.clear();
    this.anyListeners.clear();
  }
}

// Singleton
export const eventBus = new HermesEventBus();
