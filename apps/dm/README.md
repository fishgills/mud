# DM Service

The DM (Dungeon Master) service manages the core game mechanics for the text-based adventure game.

## Features

- **Player Management**: Create players and track stats (Strength, Health, Agility)
- **Monster System**: Spawn monsters and resolve combat
- **Combat System**: Ratings-based combat with diminishing returns, hit chance clamps, and mitigation
- **Inventory & Equipment**: Manage gear slots and compute combat bonuses
- **Guild Shop**: Rotate catalog items and process transactions

## API Endpoints

All HTTP routes are namespaced under `/dm`, so both local proxies and
Kubernetes workloads can rely on the same paths regardless of hostname.

### Health & system

- `GET /dm/health-check` – Lightweight service probe
- `GET /dm/system/health` – Detailed system health status
- `GET /dm/system/active-players` – Check for recent player activity
- `POST /dm/system/process-tick` – Placeholder endpoint (currently a no-op)
- `GET /dm/system/monsters` – List monsters
- `GET /dm/system/monster/:id` – Fetch a monster by ID
- `POST /dm/system/monsters` – Manual monster spawn for admins

### Player actions

- `POST /dm/players` – Create or resume a player
- `GET /dm/players` – Fetch a player by Slack workspace/user
- `GET /dm/players/leaderboard` – Top players
- `GET /dm/players/all` – Admin list of players
- `POST /dm/players/attack` – Resolve combat against players or monsters
- `GET /dm/players/items` – Inventory and equipment snapshot
- `POST /dm/players/equip|unequip` – Equipment management
- `POST /dm/players/reroll|stats|spend-skill-point` – Character sheet updates
- `POST /dm/players/heal|damage|respawn` – Admin/testing utilities

## Player Stats

Players have three core attributes:

- **Strength**: Affects damage dealt in combat
- **Health**: Affects maximum hit points (HP)
- **Agility**: Affects defense rating, initiative, and crit chance

## Combat System

Combat follows ratings-based math with diminishing returns:

- **Effective Stats**: `S' = sqrt(S)`, `A' = sqrt(A)`, `H' = sqrt(H)`, `L' = sqrt(L)`
- **Attack Rating (AR)**: `10*S' + 4*A' + 6*L'`
- **Defense Rating (DR)**: `10*A' + 2*H' + 6*L'`
- **Hit Chance**: `p_hit = clamp(sigmoid((AR - DR) / 15), 0.10, 0.90)`
- **Base Damage**: `4 + 2*S' + 0.5*L' + weapon dice`
- **Mitigation**: `T = 6*H' + 3*A'`, `mitigation = T / (T + 100)`
- **Critical Hits**: `p_crit = clamp(0.05 + (A'a - A'd) / 100, 0.05, 0.25)` with 1.5x damage
- **Initiative**: `1000*A' + 10*L' + random(0,50)` (sorted once at combat start)

### Combat Transparency

All combat logs now include detailed breakdowns:

- Attack calculations show: attack/defense ratings and hit chance
- AR/DR calculations show: effective stats feeding ratings and hit chance
- Damage calculations show: core damage + weapon dice, mitigation, and crits
- Equipment effects are displayed in combatant metrics (Str/Agi/Vit + weapon)

Example: `Hero strike: AR 62.4 vs DR 48.7 (hit 71%) -> HIT`

## Monster Types

- **Goblin**: Fast but weak (high agility, low health)
- **Orc**: Balanced fighter (medium stats)
- **Wolf**: Quick predator (high agility, medium strength)
- **Bear**: Tank (high health and strength, low agility)
- **Skeleton**: Undead warrior (low health, medium other stats)

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `PORT`: Service port (default: 3000)
- `GUILD_SHOP_ROTATION_SIZE`: Number of item templates to surface per rotation (default 6).
- `GUILD_SHOP_ROTATION_INTERVAL_MS`: Interval between automatic catalog refreshes (default 300000 ms / 5 minutes).
- `OPENAI_API_KEY`: API key for narrative/feedback helpers (optional)
- `DM_USE_VERTEX_AI`: Enable Vertex AI instead of OpenAI (optional)
- `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`: Enable feedback issue creation (optional)

## Deployment

### Local Development

```bash
yarn workspace @mud/dm serve
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
- Redis event bus (`@mud/redis-client`) for cross-service notifications
- Optional OpenAI/Vertex AI clients for feedback triage

## Example Usage

```bash
# Create a player
curl -X POST http://localhost:3000/dm/players \
  -H "Content-Type: application/json" \
  -d '{"teamId": "T123", "userId": "U123", "name": "TestPlayer"}'

# Fetch inventory snapshot
curl -X GET "http://localhost:3000/dm/players/items?teamId=T123&userId=U123"

# Attack a monster
curl -X POST http://localhost:3000/dm/players/attack \
  -H "Content-Type: application/json" \
  -d '{"teamId":"T123","userId":"U123","input":{"targetType":"monster","targetId":1}}'

# Process a game tick (currently a no-op)
curl -X POST http://localhost:3000/dm/system/process-tick
```

## Game Mechanics

### Combat Resolution

1. Compute AR/DR from effective stats and roll hit chance
2. On hit, compute base damage + weapon dice, apply mitigation and crits
3. Apply damage and check for defeat
4. Award XP if monster is defeated
5. Log combat event for history
