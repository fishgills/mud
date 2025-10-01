# Scaling Configuration for Idle Services

## Problem Solved

The Google Cloud Run services were receiving constant network traffic even when idle, preventing them from scaling to zero. The tick service was sending requests every 30 seconds, which triggered the DM service to make multiple GraphQL queries to the world service.

## Solution

Implemented an activity-based tick system that only processes game ticks when players are actively playing. Services can now scale to zero when no users are active.

## Changes Made

### 1. Player Activity Tracking

**File: `apps/dm/src/app/player/player.service.ts`**

Added methods to track and check player activity:

- `updateLastAction(slackId)` - Updates the lastAction timestamp for a player
- `hasActivePlayers(minutesThreshold)` - Checks if any players have been active within the specified time window

Player activity is automatically tracked when:

- Moving (`movePlayer`)
- Attacking/Combat (`updatePlayerStats`)
- Looking around (`getLookView`)

### 2. GraphQL API

**File: `apps/dm/src/app/graphql/resolvers/system.resolver.ts`**

Added new query:

```graphql
query HasActivePlayers($minutesThreshold: Float!) {
  hasActivePlayers(minutesThreshold: $minutesThreshold)
}
```

This allows the tick service to check for active players before processing ticks.

### 3. Smart Tick Processing

**File: `apps/tick/src/main.ts`**

Modified the tick service to:

1. Check for active players before sending `processTick`
2. Skip tick processing if no players are active
3. Made tick interval configurable via environment variables

## Configuration

### Environment Variables

#### Tick Service (`apps/tick`)

| Variable                     | Default                         | Description                               |
| ---------------------------- | ------------------------------- | ----------------------------------------- |
| `TICK_INTERVAL_MS`           | `1800000` (30 min)              | Time between ticks in milliseconds        |
| `ACTIVITY_THRESHOLD_MINUTES` | `30`                            | How far back to check for player activity |
| `DM_GRAPHQL_URL`             | `http://localhost:3000/graphql` | DM service GraphQL endpoint               |

#### DM Service (`apps/dm`)

| Variable                        | Default          | Description                            |
| ------------------------------- | ---------------- | -------------------------------------- |
| `DM_CHUNK_CACHE_TTL_MS`         | `30000` (30 sec) | World chunk cache TTL                  |
| `DM_CENTER_NEARBY_CACHE_TTL_MS` | `30000` (30 sec) | Center tile with nearby data cache TTL |

### Recommended Production Settings

For Cloud Run deployment, set these environment variables:

```bash
# Tick Service
TICK_INTERVAL_MS=1800000           # 30 minutes
ACTIVITY_THRESHOLD_MINUTES=30      # Check for activity in last 30 minutes
DM_GRAPHQL_URL=https://mud-dm-hk2n6wclvq-uc.a.run.app/graphql

# DM Service
DM_CHUNK_CACHE_TTL_MS=300000       # 5 minutes (world is static, can cache longer)
DM_CENTER_NEARBY_CACHE_TTL_MS=300000  # 5 minutes
```

### Cloud Run Scaling Configuration

For all services, consider these settings:

```yaml
# In your Cloud Run service configuration
min-instances: 0 # Scale to zero when idle
max-instances: 10 # Adjust based on load
cpu-throttling: true # Save costs when idle
timeout: 300s # 5 minutes (enough for tick processing)
```

## How It Works

### Before Changes

```
Every 30 seconds:
  tick service → DM service → multiple requests → world service
  Result: All services stay active, ~50 requests/second when "idle"
```

### After Changes

```
Every 30 minutes:
  tick service → checks hasActivePlayers

  If active players:
    tick service → DM service → processes tick → world service

  If no active players:
    tick service → logs "skipping tick"
    Services scale to zero after Cloud Run idle timeout (~15 min)
```

## Testing

### Test Activity Detection

```bash
# Check if players are active
curl -X POST https://mud-dm-hk2n6wclvq-uc.a.run.app/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { hasActivePlayers(minutesThreshold: 30) }"
  }'
```

### Monitor Tick Service Logs

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="mud-tick"' \
  --limit=20 \
  --format=json
```

Look for messages like:

- `"No active players in last 30 minutes, skipping tick"` - Service is idle
- `"Active players detected, processing tick..."` - Service is processing

### Monitor Service Scaling

```bash
# Check instance count for each service
gcloud run services describe mud-tick --region us-central1 --format="value(status.traffic[0].revisionName)"
gcloud run services describe mud-dm --region us-central1 --format="value(status.traffic[0].revisionName)"
gcloud run services describe mud-world --region us-central1 --format="value(status.traffic[0].revisionName)"
```

## Cost Optimization

With these changes:

1. **When no players are active (most of the time):**
   - Tick service runs briefly every 30 min, checks for activity, exits
   - DM service: 0 requests
   - World service: 0 requests
   - All services can scale to 0

2. **When players are active:**
   - Normal tick processing occurs
   - Services scale up as needed
   - Caching reduces redundant world service calls

3. **Expected savings:**
   - Reduce CPU hours by ~90% during idle periods
   - Reduce network egress significantly
   - Pay only for actual gameplay time

## Future Improvements

- Add Redis-based activity tracking for faster checks across multiple DM instances
- Implement exponential backoff for tick interval when no players are active
- Add metrics/monitoring for activity patterns
- Consider webhook-based tick triggering from Slack events
