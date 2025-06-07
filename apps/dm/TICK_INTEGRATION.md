# Tick Service Integration Example

This file shows how the external tick service should integrate with the DM service.

## Example Tick Service Code

```typescript
// tick-service.ts
import axios from 'axios';

interface TickResult {
  tick: number;
  gameHour: number;
  gameDay: number;
  monstersSpawned: number;
  monstersMoved: number;
  combatEvents: number;
  weatherUpdated: boolean;
}

class TickService {
  private dmServiceUrl = process.env.DM_SERVICE_URL || 'http://localhost:3000/api/dm';
  private tickInterval = 15000; // 15 seconds = 15 minutes game time

  async start() {
    console.log('Starting tick service...');
    setInterval(() => {
      this.processTick();
    }, this.tickInterval);
  }

  private async processTick() {
    try {
      const response = await axios.post(`${this.dmServiceUrl}/tick`);
      const result: TickResult = response.data.data;

      console.log(`🕐 Tick ${result.tick} - Game Time: Day ${result.gameDay}, Hour ${result.gameHour}:00`);

      if (result.monstersSpawned > 0) {
        console.log(`👹 Spawned ${result.monstersSpawned} new monsters`);
      }

      if (result.monstersMoved > 0) {
        console.log(`🚶 ${result.monstersMoved} monsters moved`);
      }

      if (result.combatEvents > 0) {
        console.log(`⚔️  ${result.combatEvents} combat events occurred`);
      }

      if (result.weatherUpdated) {
        console.log(`🌤️  Weather updated`);
      }
    } catch (error) {
      console.error('Failed to process tick:', error.message);
    }
  }
}

// Start the service
const tickService = new TickService();
tickService.start();
```

## Environment Configuration

```bash
# .env file for tick service
DM_SERVICE_URL=http://localhost:3000/api/dm
TICK_INTERVAL=15000
```

## Tick Service HTTP Call

```bash
# Manual tick trigger
curl -X POST http://localhost:3000/api/dm/tick

# Expected response:
{
  "success": true,
  "data": {
    "tick": 145,
    "gameHour": 12,
    "gameDay": 2,
    "monstersSpawned": 1,
    "monstersMoved": 5,
    "combatEvents": 2,
    "weatherUpdated": false
  }
}
```

## Game Time Calculation

- Real time: 15 seconds
- Game time: 15 minutes
- Conversion: 1 real minute = 1 game hour
- Full day cycle: 24 real minutes = 24 game hours

## Recommended Tick Frequencies

### Development/Testing

- Every 5 seconds (fast testing)
- Game hour = 20 seconds real time

### Production

- Every 15 seconds (recommended)
- Game hour = 1 minute real time

### Slow/Realistic

- Every 60 seconds
- Game hour = 4 minutes real time

## Health Monitoring

The tick service should monitor DM service health:

```typescript
async checkDmHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${this.dmServiceUrl}/health`);
    return response.status === 200;
  } catch {
    return false;
  }
}
```

## Error Handling

```typescript
private async processTick() {
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await this.callDmTick();
      return; // Success
    } catch (error) {
      retries++;
      console.warn(`Tick failed (attempt ${retries}/${maxRetries}):`, error.message);

      if (retries < maxRetries) {
        await this.delay(1000 * retries); // Exponential backoff
      }
    }
  }

  console.error('Tick processing failed after all retries');
}
```
