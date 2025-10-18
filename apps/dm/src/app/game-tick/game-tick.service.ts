import { Injectable, Logger } from '@nestjs/common';
import { getPrismaClient } from '@mud/database';
import { EventBus } from '@mud/engine';
import { PlayerService } from '../player/player.service';
import { PopulationService } from '../monster/population.service';
import type { TickResult } from '../api';
import { MonsterService } from '../monster/monster.service';
import { env } from '../../env';

@Injectable()
export class GameTickService {
  private prisma = getPrismaClient();
  private logger = new Logger(GameTickService.name);

  constructor(
    private playerService: PlayerService,
    private populationService: PopulationService,
    private monsterService: MonsterService,
  ) {}

  async processTick(): Promise<TickResult> {
    let gameState = await this.prisma.gameState.findFirst();
    if (!gameState) {
      gameState = await this.prisma.gameState.create({
        data: { tick: 0, gameHour: 0, gameDay: 1 },
      });
    }

    const newTick = gameState.tick + 1;
    let newHour = gameState.gameHour;
    let newDay = gameState.gameDay;

    if (newTick % 4 === 0) {
      newHour += 1;
      if (newHour >= 24) {
        newHour = 0;
        newDay += 1;
      }
    }

    await this.prisma.gameState.update({
      where: { id: gameState.id },
      data: {
        tick: newTick,
        gameHour: newHour,
        gameDay: newDay,
      },
    });

    const tickTimestamp = new Date();
    await EventBus.emit({
      eventType: 'world:time:tick',
      tick: newTick,
      gameHour: newHour,
      gameDay: newDay,
      timestamp: tickTimestamp,
    });

    let monstersSpawned = 0;
    let monstersMoved = 0;
    let combatEvents = 0;
    let weatherUpdated = false;

    // Configurable movement parameters for scalability
    const ACTIVE_RADIUS = env.MOVEMENT_ACTIVE_RADIUS;
    const MOVEMENT_PARTITIONS = Math.max(1, env.MOVEMENT_PARTITIONS);
    const MOVEMENT_CONCURRENCY = Math.max(1, env.MOVEMENT_CONCURRENCY);
    const MOVEMENT_CHANCE = Math.min(1, Math.max(0, env.MOVEMENT_CHANCE));
    const MOVEMENT_BUDGET = Math.max(1, env.MOVEMENT_BUDGET);

    // Helper: simple concurrency limiter without extra deps
    const withConcurrency = async <T, R>(
      items: T[],
      limit: number,
      worker: (item: T, index: number) => Promise<R>,
    ): Promise<R[]> => {
      const results: R[] = [];
      let idx = 0;
      const runners: Promise<void>[] = [];
      const run = async () => {
        while (idx < items.length) {
          const current = idx++;
          try {
            const r = await worker(items[current], current);
            results[current] = r;
          } catch {
            // swallow to keep pool running; errors are logged in worker
          }
        }
      };
      const pool = Math.min(limit, Math.max(1, items.length));
      for (let i = 0; i < pool; i++) runners.push(run());
      await Promise.all(runners);
      return results;
    };

    // 1) Spawn/maintain density only around active (alive) players
    const allPlayers = await this.playerService.getAllPlayers();
    const activePlayers = allPlayers.filter((p) => p.combat.isAlive);
    for (const player of activePlayers) {
      const { spawned, report } =
        await this.populationService.enforceDensityAround(
          player.position.x,
          player.position.y,
          12,
          6,
        );
      monstersSpawned += spawned;
      if (report.length) {
        const lines = report
          .filter((r) => r.spawned > 0 || r.deficit > 0)
          .map(
            (r) =>
              `${r.biome}: tiles=${r.tiles} target=${r.targetCount} current=${r.current} deficit=${r.deficit} spawned=${r.spawned}`,
          )
          .join(' | ');
        if (lines) {
          this.logger.debug(
            `Density around (${player.position.x},${player.position.y}) -> ${lines}`,
          );
        }
      }
    }

    // 2) Move monsters near active players only, partitioned by ID and capped by budget
    const candidateById = new Map<number, { id: number }>();
    for (const p of activePlayers) {
      const minX = p.position.x - ACTIVE_RADIUS;
      const maxX = p.position.x + ACTIVE_RADIUS;
      const minY = p.position.y - ACTIVE_RADIUS;
      const maxY = p.position.y + ACTIVE_RADIUS;
      const nearby = await this.monsterService.getMonstersInBounds(
        minX,
        maxX,
        minY,
        maxY,
      );
      for (const m of nearby) {
        // partition monsters across ticks to avoid hotspotting
        if (m.id % MOVEMENT_PARTITIONS !== newTick % MOVEMENT_PARTITIONS)
          continue;
        candidateById.set(m.id, { id: m.id });
      }
    }

    const candidates = Array.from(candidateById.values());
    // Randomize order
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const toAttempt = candidates.slice(0, MOVEMENT_BUDGET);
    await withConcurrency(toAttempt, MOVEMENT_CONCURRENCY, async (m) => {
      if (Math.random() < MOVEMENT_CHANCE) {
        try {
          await this.monsterService.moveMonster(m.id);
          monstersMoved++;
        } catch (err) {
          this.logger.debug(
            `moveMonster(${m.id}) failed: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
      return undefined as unknown as void;
    });

    // 3) Proximity combat checks only where players are located
    for (const player of activePlayers) {
      const monstersHere = await this.monsterService.getMonstersAtLocation(
        player.position.x,
        player.position.y,
      );
      if (!monstersHere.length) continue;
      for (const monster of monstersHere) {
        if (Math.random() >= 0.2) continue;
        try {
          const playerIdentifier = this.resolvePlayerIdentifier(player);
          if (!playerIdentifier) {
            this.logger.debug(
              'Player has no clientId or slackId, skipping combat',
            );
            continue;
          }
          await EventBus.emit({
            eventType: 'combat:initiate',
            attacker: {
              type: 'monster',
              id: monster.id,
              name: monster.name,
            },
            defender: {
              type: 'player',
              id: playerIdentifier,
              name: player.name,
            },
            metadata: {
              source: 'game-tick.service',
              reason: 'proximity-aggro',
            },
            timestamp: new Date(),
          });
          combatEvents++;
        } catch (error) {
          this.logger.debug(
            `Combat failed for monster=${monster.id} -> ${player.name}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
        }
      }
    }

    if (newTick % 10 === 0) {
      await this.monsterService.cleanupDeadMonsters();
    }

    if (newTick % 4 === 0) {
      const weatherChange = await this.updateWeather();
      weatherUpdated = Boolean(weatherChange);
      if (weatherChange) {
        await EventBus.emit({
          eventType: 'world:weather:change',
          oldWeather: weatherChange.oldState,
          newWeather: weatherChange.newState,
          timestamp: new Date(),
        });
      }
    }

    return {
      tick: newTick,
      gameHour: newHour,
      gameDay: newDay,
      monstersSpawned,
      monstersMoved,
      combatEvents,
      weatherUpdated,
    };
  }

  private async updateWeather(): Promise<{
    oldState: string;
    newState: string;
  } | null> {
    let weather = await this.prisma.weatherState.findFirst();

    if (!weather) {
      weather = await this.prisma.weatherState.create({
        data: {
          state: 'clear',
          pressure: 1013,
        },
      });
      return null;
    }

    const oldState = weather.state;
    const pressureChange = Math.floor(Math.random() * 20) - 10;
    const newPressure = Math.max(
      980,
      Math.min(1040, weather.pressure + pressureChange),
    );

    let newState = weather.state;

    if (newPressure < 995) {
      newState = Math.random() < 0.5 ? 'lightning' : 'raining';
    } else if (newPressure < 1005) {
      newState = 'overcast';
    } else if (newPressure < 1015) {
      newState = 'cloudy';
    } else {
      newState = 'clear';
    }

    await this.prisma.weatherState.update({
      where: { id: weather.id },
      data: {
        state: newState,
        pressure: newPressure,
      },
    });

    return newState !== oldState ? { oldState, newState } : null;
  }

  async getGameState() {
    const gameState = await this.prisma.gameState.findFirst();
    const weather = await this.prisma.weatherState.findFirst();

    return {
      gameState,
      weather,
    };
  }

  private resolvePlayerIdentifier(player: {
    clientId?: string;
    clientType?: string;
  }): string | undefined {
    const { clientId } = player ?? {};
    const normalized = clientId?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
  }
}
