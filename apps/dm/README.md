# DM Service

The DM (Dungeon Master) service manages the core game mechanics for the text-based adventure game.

## Features

- **Player Management**: Create players, handle movement (n/s/e/w), track stats (Strength, Health, Agility)
- **Monster System**: Spawn monsters, handle AI movement and combat
- **Combat System**: D&D-like combat mechanics with dice rolls, stat modifiers, and dodge chances
- **Game Tick**: Process world updates when called by the external tick service
- **World Integration**: Fetch tile and location data from the world service

## API Endpoints

All HTTP routes are namespaced under `/dm`, so both local proxies and
Kubernetes workloads can rely on the same paths regardless of hostname.

### Health & tick coordination

- `GET /dm/health-check` – Lightweight service probe
- `GET /dm/system/health` – Detailed system health status
- `POST /dm/system/process-tick` – Advance the simulation (called by the tick worker)
- `GET /dm/system/game-state` – Snapshot of monsters/time/weather
- `GET /dm/system/active-players` – Check for recent player activity

### World and location data

- `GET /dm/location/players|monsters|items` – Inspect entities at a coordinate
- `GET /dm/movement/look` – Rich description of the player’s current tile
- `GET /dm/movement/sniff` – Nearby monster detection summary

### Player actions

- `POST /dm/players` – Create or resume a player
- `GET /dm/players` – Fetch a player by Slack workspace/user
- `POST /dm/players/attack` – Resolve combat against players or monsters
- `POST /dm/movement/move` – Move a player N/S/E/W/U/D
- `POST /dm/players/pickup|drop|equip|unequip` – Inventory management
- `POST /dm/players/reroll|stats|spend-skill-point` – Character sheet updates
- `POST /dm/system/monsters` – Manual monster spawn for admins

## Player Stats

Players have three core attributes (like D&D warriors):

- **Strength**: Affects damage dealt in combat
- **Health**: Affects maximum hit points (HP)
- **Agility**: Affects dodge chance in combat

## Combat System

Combat follows simplified D&D mechanics:

- **Attack Roll**: d20 + Strength modifier + Equipment attack bonus vs AC
- **Armor Class (AC)**: 10 + Agility modifier + Equipment armor bonus
- **Damage**: Base damage (from Strength) + Equipment damage bonus
- **Modifiers**: (Ability - 10) / 2 (rounded down)
- Players gain XP for defeating monsters

### Combat Transparency

All combat logs now include detailed breakdowns:

- Attack calculations show: dice roll + ability modifier + equipment bonus
- AC calculations show: base AC + ability modifier + armor bonus
- Damage calculations show: base damage + weapon/equipment bonus
- Equipment effects are displayed in combatant metrics (Atk +X, Dmg +Y, AC +Z)

Example: `Hero attack: d20 15 + 2 (Str) + 3 (Equipment) = 20 vs AC 10 + 1 (Agi) + 4 (Armor) = 15 -> HIT`

## Monster Types

- **Goblin**: Fast but weak (high agility, low health)
- **Orc**: Balanced fighter (medium stats)
- **Wolf**: Quick predator (high agility, medium strength)
- **Bear**: Tank (high health and strength, low agility)
- **Skeleton**: Undead warrior (low health, medium other stats)

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `WORLD_SERVICE_URL`: URL for the world service (default: https://closet.battleforge.app/world)
- `PORT`: Service port (default: 3000)
- `GUILD_SEED_ENABLED`: When `true` (default) the Docker entrypoint seeds guild hall data on startup.
- `GUILD_SEED_CATALOG_PATH` / `GUILD_SEED_ANNOUNCEMENTS_PATH`: Override the default fixture locations (`apps/dm/scripts/data/*.json`) when seeding.
- `GUILD_SEED_TILE`, `GUILD_SEED_NAME`, `GUILD_SEED_COORDS`, `GUILD_SEED_ARRIVAL`, `GUILD_SEED_COOLDOWN_SECONDS`, `GUILD_SEED_POPULATION_LIMIT`: Customize guild metadata applied during seeding.
- `GUILD_SEED_RESET`: Set to `true` only when you intentionally want to wipe and recreate catalog/announcement rows.
- `GUILD_SHOP_ROTATION_SIZE`: Number of item templates to surface per rotation (default 6).
- `GUILD_SHOP_ROTATION_INTERVAL_MS`: Interval between automatic catalog refreshes (default 300000 ms / 5 minutes).

## Deployment

### Local Development

```bash
yarn serve  # Starts all services with hot reload
```

### Production (GKE)

The DM service runs as a Kubernetes deployment on Google Kubernetes Engine. Infrastructure is managed via Terraform in `infra/terraform/`.

- **Cluster**: `mud-${environment}` (managed by Terraform)
- **Database**: Cloud SQL (PostgreSQL 15)
- **Cache**: Memorystore (Redis)
- **Container Registry**: Artifact Registry (`mud-services`)
- **Secrets**: Stored in Secret Manager, synced to Kubernetes
- **Ingress**: Shared GKE ingress with managed certificates

See `docs/DEPLOYMENT.md` for full deployment documentation.

## Dependencies

- Database library (`@mud/database`) for PostgreSQL access
- World service for tile and biome information
- Tick service for coordinated world updates
- Redis event bus (`@mud/redis-client`) for cross-service notifications

## Example Usage

```bash
# Create a player
curl -X POST http://localhost:3000/dm/players \
  -H "Content-Type: application/json" \
  -d '{"teamId": "T123", "userId": "U123", "name": "TestPlayer"}'

# Move player north
curl -X POST http://localhost:3000/dm/movement/move \
  -H "Content-Type: application/json" \
  -d '{"teamId": "T123", "userId": "U123", "move": { "direction": "north" }}'

# Attack a monster
curl -X POST http://localhost:3000/dm/players/attack \
  -H "Content-Type: application/json" \
  -d '{"teamId":"T123","userId":"U123","input":{"targetType":"monster","targetId":1}}'

# Process a game tick
curl -X POST http://localhost:3000/dm/system/process-tick
```

## Game Mechanics

### Tick Processing

Every tick (called by external service):

1. Advance game time (15 minutes per tick)
2. 5% chance to spawn monsters near active players
3. 40% chance for each monster to move randomly
4. 20% chance for monsters to attack nearby players
5. Update weather every hour (4 ticks)
6. Clean up dead monsters every 10 ticks

### Combat Resolution

1. Calculate damage with dice roll + stat modifier
2. Check for dodge based on defender's agility
3. Apply damage and check for death
4. Award XP if monster is defeated
5. Log combat event for location history

This service coordinates with:

- **World Service**: Provides tile data and biome information
- **Tick Service**: Calls the tick endpoint to advance game state
- **Database**: Stores player/monster data and combat logs
