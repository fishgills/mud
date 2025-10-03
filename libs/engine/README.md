# @mud/engine

Client-agnostic MUD game engine with event-driven architecture.

## Overview

This library provides the core game logic and entity management for the Mud game, inspired by RanvierMUD's architecture. It's designed to be completely independent of any specific client implementation (Slack, Discord, Web, etc.).

## Features

- **Event-Driven Architecture**: EventBus for decoupled communication
- **Factory Pattern**: Create game entities with consistent logic
- **Game Entities**: Players, NPCs, Monsters, Parties, Settlements
- **Behavior System**: Pluggable AI behaviors for NPCs and Monsters
- **Client-Agnostic**: No dependencies on Slack, Discord, or any specific client

## Architecture

```
EventBus (Central dispatcher)
    ↓
Factories (Create entities)
    ↓
Entities (Game objects)
    ↓
Behaviors (AI logic)
```

## Usage

```typescript
import { EventBus, PlayerFactory, NpcFactory } from '@mud/engine';

// Subscribe to events
EventBus.on('player:move', (event) => {
  console.log(`${event.player.name} moved to ${event.x}, ${event.y}`);
});

// Create entities
const player = await PlayerFactory.create({
  name: 'Hero',
  clientId: 'user-123',
  clientType: 'slack',
});

// Emit events
EventBus.emit('player:spawn', { player });
```
