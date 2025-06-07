# DM Service Environment Configuration

## Environment Variables

Create a `.env` file in the database library directory (`libs/database/.env`) with the following variables:

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/mud"

# External Service URLs
WORLD_SERVICE_URL="http://localhost:3001/api"
TICK_SERVICE_URL="http://localhost:3002/api"

# DM Service Configuration
PORT=3000
NODE_ENV=development
```

## Database Setup

1. Ensure PostgreSQL is running
2. Create the database: `createdb mud`
3. Run Prisma migrations:
   ```bash
   cd libs/database
   npx prisma migrate dev
   ```

## Service Dependencies

The DM service depends on:

1. **Database**: PostgreSQL database with Prisma schema
2. **World Service** (optional): Provides tile and biome data
3. **Tick Service** (external): Calls the `/tick` endpoint periodically

## Starting the Services

```bash
# Start the DM service
npx nx serve dm

# Or build and run
npx nx build dm
node apps/dm/dist/main.js
```

## Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tick Service  │───▶│   DM Service    │───▶│  World Service  │
│   (External)    │    │   (This App)    │    │   (apps/world)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   PostgreSQL    │
                        │   Database      │
                        │ (libs/database) │
                        └─────────────────┘
```

## Testing

Use the provided test script:

```bash
./apps/dm/test-dm.sh
```

This will test all major endpoints and demonstrate the complete workflow.
