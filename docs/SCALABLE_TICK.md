# Scalable Tick Architecture

This document outlines a scalable approach for the DM tick pipeline to support very large worlds and monster populations.

## Goals

- Eliminate O(N) scans over all monsters
- Keep work proportional to active regions (players, settlements, events)
- Provide smooth load via partitioning and budgets
- Scale horizontally on GCP with strong coordination guarantees

## In-service improvements (done)

- Interest-based selection: consider monsters within `MOVEMENT_ACTIVE_RADIUS` of any living player only
- Partitioned movement: process monsters where `id % MOVEMENT_PARTITIONS === tick % MOVEMENT_PARTITIONS`
- Movement budget and concurrency limits: cap total actions per tick and bound concurrent I/O
- Locality: combat checks occur only on tiles with players

Env knobs (apps/dm/src/env.ts):

- MOVEMENT_ACTIVE_RADIUS (default 50)
- MOVEMENT_PARTITIONS (default 4)
- MOVEMENT_CONCURRENCY (default 25)
- MOVEMENT_CHANCE (default 0.4)
- MOVEMENT_BUDGET (default 1000)

## GCP sharded ticks

- Cloud Scheduler: every T interval, publish shard messages to Pub/Sub topic `dm-tick-shard`
- Pub/Sub: messages contain shard metadata (e.g., chunk ranges or id modulo values)
- Cloud Run worker (DM or dedicated tick-worker):
  - Receives shard message
  - Resolves active players intersecting its shard
  - Runs interest-based movement and combat for the shard
  - Uses Redis locks (coordination prefix) to avoid duplicate shard processing

### Shard strategies

- Spatial (preferred):
  - Partition world into chunks (e.g., 50x50). Assign chunk ranges per shard
  - Query monsters via indexes on (isAlive, chunkX, chunkY) or use Redis chunk buckets
- ID modulo:
  - Simple: `monster.id % N === shard`
  - Less locality but easy rollout

### Coordination

- Use Redis (existing) to implement locks and dedupe keys:
  - Key: `dm:coord:tick:{tickNumber}:{shardId}` with TTL
  - Only the winner processes the shard

### Autoscaling

- Cloud Run autoscaling handles concurrent shard workers
- Tune request concurrency to match DB/world throughput and `MOVEMENT_CONCURRENCY`

## Database indexes

- Prisma schema adds:
  - `@@index([isAlive, x, y])`
  - `@@index([x, y])`
- Optional: chunk columns for monsters:
  - Add `chunkX`, `chunkY` with index `@@index([isAlive, chunkX, chunkY])`
  - Compute in-app or as generated columns
- Advanced: PostGIS `GEOMETRY(Point)` with GiST if spatial queries dominate

## Redis chunk buckets (optional fast path)

- Maintain sets `monsters:chunk:{cx}:{cy}`
- On spawn/move/death update sets accordingly
- For each player, compute intersecting chunk keys within radius and union to get candidate IDs
- Load minimal details by ID from DB or cache; dramatically reduces scans

## Future work

- Batch world lookups per region using `getTilesInBounds` instead of per-entity calls
- Back EventBus with Pub/Sub adapter for cross-service consumers
- Add metrics for tick time, movement attempts, combat initiations, and DB latency

---

## Ideal state blueprint (reference design)

This section documents a complete end-to-end design to reach “internet scale” ticks. It’s intentionally more detailed than we need today, so future work has a clear target.

### 1) Sharded tick orchestration

- Trigger: Cloud Scheduler fires every T seconds and publishes N shard messages to Pub/Sub topic `dm-tick-shard`.
- Message schema:
  - `tick`: integer (logical tick number)
  - `shardId`: integer (0..N-1)
  - `strategy`: `spatial|idModulo`
  - `range`: for spatial: `{ minCx, maxCx, minCy, maxCy }` (chunk coords); for idModulo: `{ modulo, remainder }`
  - `ts`: ISO timestamp for traceability
- Worker: Cloud Run service `dm-tick-worker` subscribed to `dm-tick-shard`:
  - Validates message and acquires a Redis lock: `dm:coord:tick:{tick}:{shardId}` (TTL ~ 2x T)
  - If lock acquired, runs shard and sets idempotency key `dm:coord:done:{tick}:{shardId}` (short TTL + archive logs)
  - If `done` exists, ack and skip (idempotent)

### 2) Shard processing contract

Inputs:

- `tick`, shard metadata (spatial range or idModulo), environment tunables

Steps:

- Resolve active players intersecting shard (from DB or cache)
- Determine candidate monsters:
  - Spatial: union of Redis chunk bucket sets within ACTIVE_RADIUS of each player; intersect with shard’s chunk range
  - idModulo: filter by `id % MOVEMENT_PARTITIONS == tick % MOVEMENT_PARTITIONS` and location within shard bounds if spatially constrained
- Apply movement selection:
  - Shuffle candidates, cap to MOVEMENT_BUDGET, run with MOVEMENT_CONCURRENCY
  - Persist moves; update chunk buckets if using Redis fast-path
- Proximity combat:
  - For each player location, fetch monsters-at-tile and roll aggro chance
  - Emit `combat:initiate` event (EventBus backed by Pub/Sub adapter)
- Periodic maintenance hooks (e.g., cleanup every 10 ticks, weather every 4)

Outputs:

- `ShardResult`: `{ tick, shardId, moved, combatEvents, spawned, durationMs, errors? }`
- Emit `world:tick:shard:done` with metrics

Error modes:

- Lock contention → skip
- Partial failure → include `errors` and continue; rely on next ticks and budgets for eventual progress

### 3) Spatial chunking schema

DB (Prisma additions):

- Monster: `chunkX Int`, `chunkY Int`
- Indexes: `@@index([isAlive, chunkX, chunkY])`, optional partial indexes per biome/type as needed
- Optionally compute chunk columns in-app or with generated columns

Redis:

- Sets: `monsters:chunk:{cx}:{cy}`
- On spawn: SADD into current chunk
- On move: if chunk changed, SREM old and SADD new
- On death/despawn: SREM

Deriving candidates near a player:

- Compute chunk radius from tile radius (e.g., 50 tile radius with 25x25 chunks → radius=2 chunks)
- Union keys for covered chunks, then sample up to MOVEMENT_BUDGET

### 4) Idempotency and locking

- Lock key: `dm:coord:lock:{tick}:{shardId}` with TTL slightly larger than expected shard time
- Done key: `dm:coord:done:{tick}:{shardId}` with short TTL (e.g., 2x T) to absorb Pub/Sub redeliveries
- Use Lua script or Redlock-style pattern to ensure atomicity if needed

### 5) Observability and SLOs

Metrics (export via Prometheus/OpenTelemetry):

- `tick.duration_ms` (overall and per-shard)
- `tick.movement_attempts`, `tick.movement_successes`
- `tick.combat_events`
- `db.query_ms` per DAO method and P95/P99
- `redis.op_ms` and error counts
- `pubsub.redeliveries` per shard

Logs:

- Structured JSON with shardId, tick, ranges, counts
- Sample detailed movement failures with monsterId and cause

Tracing:

- One span per shard, nested spans for DB/Redis/World calls; include correlation ids from Pub/Sub message

Dashboards & Alerts:

- Burn rate alerts on tick latency SLO
- Error-rate alerts on movement failures and pubsub redeliveries

### 6) Rollout plan

Phased rollout toggled by env flags:

1. In-service interest-based (current)
2. ID modulo shards (single instance consumes all messages)
3. Spatial shards without Redis buckets (DB-index only)
4. Spatial shards with Redis chunk buckets (fast-path)
5. PostGIS adoption (optional) for very large worlds

Each phase gated behind feature flags and observed for stability before progressing.

### 7) Operations runbook

Common procedures:

- Unlock stuck shard: delete `dm:coord:lock:{tick}:{shardId}` if TTL not expiring and no worker active (after validation)
- Re-run shard: re-publish message with same `{tick, shardId}` if `done` not set and data is safe to retry
- Scale up: increase Cloud Run max instances and/or MOVEMENT_CONCURRENCY, MOVEMENT_BUDGET with caution

Failure handling:

- If Redis unavailable, fall back to best-effort idModulo with no locks; mark degraded mode and reduce budgets
- If DB slow, reduce MOVEMENT_CONCURRENCY and enable backoff; rely on Scheduler catch-up

### 8) API surface (proto)

For cross-service clarity, the shard worker may expose an internal endpoint:

`POST /internal/tick/shard`

- body: `{ tick, shardId, strategy, range }`
- response: `ShardResult`
- Auth: Cloud Run IAM or signed metadata headers from Scheduler/Tasks

Longer-term, prefer pure Pub/Sub consumption to avoid HTTP ingress.

### 9) Cost controls

- Prefer Redis chunk buckets to cut DB load by 10–100x in hotspots
- Cache stable tiles/biomes in Redis with TTLs
- Batch DB updates (movement) where safe, e.g., transactional upserts per shard
- AI calls remain out-of-band and heavily cached; no AI in tick path
