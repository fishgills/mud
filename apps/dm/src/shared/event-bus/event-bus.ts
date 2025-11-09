/**
 * Event Bus - Central event dispatcher inspired by RanvierMUD
 * Allows decoupled communication between game systems
 */

import { Logger } from '@nestjs/common';
import { GameEvent, GameEventType, EventListener } from './game-events';

export class EventBus {
  private static readonly logger = new Logger(EventBus.name);
  private static listeners: Map<GameEventType, Set<EventListener>> = new Map();
  private static wildcardListeners: Set<EventListener> = new Set();

  /**
   * Subscribe to a specific event type
   */
  static on<T extends GameEvent>(
    eventType: T['eventType'],
    listener: EventListener<T>,
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(listener as EventListener);

    // Return unsubscribe function
    return () => this.off(eventType, listener);
  }

  /**
   * Subscribe to all events (wildcard listener)
   */
  static onAny(listener: EventListener): () => void {
    this.wildcardListeners.add(listener);
    return () => this.offAny(listener);
  }

  /**
   * Unsubscribe from a specific event type
   */
  static off<T extends GameEvent>(
    eventType: T['eventType'],
    listener: EventListener<T>,
  ): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener as EventListener);
    }
  }

  /**
   * Unsubscribe from all events (wildcard listener)
   */
  static offAny(listener: EventListener): void {
    this.wildcardListeners.delete(listener);
  }

  /**
   * Emit an event to all subscribers
   */
  static async emit<T extends GameEvent>(event: T): Promise<void> {
    const eventWithTimestamp: T = {
      ...event,
      timestamp: event.timestamp || new Date(),
    };

    // Call specific event listeners
    const listeners = this.listeners.get(event.eventType);
    if (listeners) {
      const promises = Array.from(listeners).map((listener) =>
        Promise.resolve(listener(eventWithTimestamp)),
      );
      await Promise.all(promises);
    }

    // Call wildcard listeners
    if (this.wildcardListeners.size > 0) {
      const wildcardPromises = Array.from(this.wildcardListeners).map(
        (listener) => Promise.resolve(listener(eventWithTimestamp)),
      );
      await Promise.all(wildcardPromises);
    }
  }

  /**
   * Emit an event synchronously (fire and forget)
   */
  static emitSync<T extends GameEvent>(event: T): void {
    const eventWithTimestamp: T = {
      ...event,
      timestamp: event.timestamp || new Date(),
    };

    // Call specific event listeners
    const listeners = this.listeners.get(event.eventType);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          void listener(eventWithTimestamp);
        } catch (error) {
          this.logger.error(
            `Error in event listener for ${event.eventType}`,
            error as Error,
          );
        }
      });
    }

    // Call wildcard listeners
    this.wildcardListeners.forEach((listener) => {
      try {
        void listener(eventWithTimestamp);
      } catch (error) {
        this.logger.error('Error in wildcard event listener', error as Error);
      }
    });
  }

  /**
   * Remove all listeners
   */
  static clear(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
  }

  /**
   * Get count of listeners for an event type
   */
  static listenerCount(eventType: GameEventType): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  /**
   * Get all event types that have listeners
   */
  static eventTypes(): GameEventType[] {
    return Array.from(this.listeners.keys());
  }
}
