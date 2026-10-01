type EventCallback = (event: { type: string; data: any }) => void;

class EventBus {
  private listeners: Set<EventCallback> = new Set();

  subscribe(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  emit(type: string, data: any) {
    for (const callback of this.listeners) {
      try {
        callback({ type, data });
      } catch (err) {
        console.error("Error in event listener:", err);
      }
    }
  }
}

// Global singleton across requests in Node/Next runtime
const globalForEvents = globalThis as unknown as { eventBus?: EventBus };
export const eventBus = globalForEvents.eventBus ?? new EventBus();
if (process.env.NODE_ENV !== "production") globalForEvents.eventBus = eventBus;
