# Database Library

This library provides a shared Prisma client and database utilities for the MUD game workspace.

## Features

- **Singleton Prisma Client**: Ensures only one database connection across the application
- **Shared Schema**: Centralized database schema for all services
- **Type Safety**: Exports all Prisma-generated types for use across applications
- **Migration Management**: Centralized database migrations

## Usage

```typescript
import { getPrismaClient, type Player, type WorldTile } from '@mud/database';

const prisma = getPrismaClient();

// Use the client for database operations
const player = await prisma.player.findFirst();
```

## Available Exports

- `getPrismaClient()`: Returns the singleton Prisma client instance
- `disconnectPrisma()`: Properly disconnects the Prisma client
- `PrismaClient`: The Prisma client class (for type annotations)
- `Prisma`: The Prisma namespace (for advanced types)
- Types: `Player`, `WorldTile`, `Biome`, `Monster`, `WeatherState`, `GameState`

## Database Schema

The schema includes models for:
- **Player**: Game player data with location tracking
- **WorldTile**: Game world tiles with biome relationships
- **Biome**: Environment types and descriptions
- **Monster**: NPCs and creatures
- **WeatherState**: Dynamic weather system
- **GameState**: Global game state tracking

## Migrations

Database migrations are stored in `libs/database/prisma/migrations/` and can be run using:

```bash
cd libs/database
npx prisma migrate dev --name "your_migration_name"
```

## Development

To regenerate the Prisma client after schema changes:

```bash
cd libs/database
npx prisma generate
nx build @mud/database
```
