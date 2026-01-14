# Database Library

This library provides a shared Prisma client and database utilities for the MUD game workspace.

## Features

- **Singleton Prisma Client**: Ensures only one database connection across the application
- **Shared Schema**: Centralized database schema for all services
- **Type Safety**: Exports all Prisma-generated types for use across applications
- **Migration Management**: Centralized database migrations

## Usage

```typescript
import { getPrismaClient, type Player, type Monster } from '@mud/database';

const prisma = getPrismaClient();

// Use the client for database operations
const player = await prisma.player.findFirst();
```

## Available Exports

- `getPrismaClient()`: Returns the singleton Prisma client instance
- `disconnectPrisma()`: Properly disconnects the Prisma client
- `PrismaClient`: The Prisma client class (for type annotations)
- `Prisma`: The Prisma namespace (for advanced types)
- Types: `Player`, `Monster`, `CombatLog`, `Item`, `PlayerItem`, `SlackUser`, `ShopCatalogItem`

## Database Schema

The schema includes models for:

- **Player**: Core player data and progression
- **Monster**: Monster definitions for combat
- **Item**: Equipment templates and stats
- **PlayerItem**: Inventory and equipped gear
- **ShopCatalogItem**: Rotating shop inventory

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
yarn prisma generate
yarn build @mud/database
```
