# DM Service

The DM (Dungeon Master) service manages the core game mechanics for the text-based adventure game.

## Features

- **Player Management**: Create players, handle movement (n/s/e/w), track stats (Strength, Health, Agility)
- **Monster System**: Spawn monsters, handle AI movement and combat
- **Combat System**: D&D-like combat mechanics with dice rolls, stat modifiers, and dodge chances
- **Game Tick**: Process world updates when called by the external tick service
- **World Integration**: Fetch tile and location data from the world service

## API Endpoints

### Health Check

- `GET /api/dm/health` - Service health check

### Game Management

- `POST /api/dm/tick` - Process game world tick (called by tick service)
- `GET /api/dm/game-state` - Get current game state (time, weather)

### Player Management

- `POST /api/dm/player` - Create a new player
- `GET /api/dm/player/:slackId` - Get player info with location data
- `POST /api/dm/player/:slackId/move` - Move player (body: `{direction: "n|s|e|w"}`)
- `POST /api/dm/player/:slackId/attack` - Attack target (body: `{targetType: "player|monster", targetId: number}`)
- `POST /api/dm/player/:slackId/respawn` - Respawn dead player

### World Information

- `GET /api/dm/location/:x/:y` - Get complete location info (players, monsters, combat log)
- `GET /api/dm/players` - Get all players
- `GET /api/dm/monsters` - Get all monsters

### Admin

- `POST /api/dm/admin/spawn-monster/:x/:y` - Manually spawn a monster

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
- `WORLD_SERVICE_URL`: URL for the world service (default: http://localhost:3001/api)
- `PORT`: Service port (default: 3000)

## Dependencies

- Database library (`@mud/database`) for PostgreSQL access
- World service for tile and biome information
- Tick service for coordinated world updates

## Example Usage

```bash
# Create a player
curl -X POST http://localhost:3000/api/dm/player \
  -H "Content-Type: application/json" \
  -d '{"slackId": "U123456", "name": "TestPlayer"}'

# Move player north
curl -X POST http://localhost:3000/api/dm/player/U123456/move \
  -H "Content-Type: application/json" \
  -d '{"direction": "n"}'

# Attack a monster
curl -X POST http://localhost:3000/api/dm/player/U123456/attack \
  -H "Content-Type: application/json" \
  -d '{"targetType": "monster", "targetId": 1}'

# Process a game tick
curl -X POST http://localhost:3000/api/dm/tick
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
