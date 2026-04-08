type Listener<T = unknown> = (data: T) => void;

/**
 * Tiny, zero-dependency event emitter that replaces rxjs.
 * Supports typed events via generics.
 */
export class EventEmitter<
  Events extends Record<string, unknown> = Record<string, unknown>
> {
  private listeners: Map<keyof Events, Set<Listener<unknown>>> = new Map();

  on<K extends keyof Events>(
    event: K,
    listener: Listener<Events[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<unknown>);
    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  once<K extends keyof Events>(
    event: K,
    listener: Listener<Events[K]>
  ): () => void {
    const wrapper: Listener<Events[K]> = (data) => {
      try {
        listener(data);
      } finally {
        // Always unsubscribe — even if the listener throws
        this.off(event, wrapper);
      }
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    // Iterate over a snapshot so that listeners added/removed during emit don't
    // affect the current call, and a throwing listener doesn't silently drop the rest.
    for (const l of Array.from(listeners)) {
      try {
        l(data);
      } catch (e) {
        console.error('[rn-game-engine-next] Event listener error:', e);
      }
    }
  }

  removeAllListeners(event?: keyof Events): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: keyof Events): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
