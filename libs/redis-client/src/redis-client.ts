/**
 * Redis Client Library
 *
 * This library provides Redis utilities for the Mud project:
 * - RedisEventBridge: Bridge in-memory EventBus to Redis Pub/Sub for cross-service events
 * - GameEvent types: Domain event types shared across services
 */

export * from './event-bridge.js';
export * from './game-events.js';
export * from './recipients.js';
