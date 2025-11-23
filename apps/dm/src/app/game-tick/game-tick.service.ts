import { Injectable, Logger } from '@nestjs/common';
import { getPrismaClient } from '@mud/database';
import { EventBus } from '../../shared/event-bus';
import { PlayerService } from '../player/player.service';
import { PopulationService } from '../monster/population.service';
import type { TickResult } from '../api';
import { MonsterService } from '../monster/monster.service';
import { env } from '../../env';

@Injectable()
export class GameTickService {
  private prisma = getPrismaClient();
  private logger = new Logger(GameTickService.name);
  private lastSpawnTickByPlayer = new Map<string, number>();

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
    let weatherUpdated = false;
    let monstersPruned = 0;

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
    const activityWindowMinutes = env.ACTIVE_PLAYER_WINDOW_MINUTES;
    const activePlayers =
      (await this.playerService.getActivePlayers(activityWindowMinutes)) ?? [];

    this.logger.debug(
      `Tick ${newTick}: ${activePlayers.length} active player(s) in last ${activityWindowMinutes} minutes.`,
    );

    const prunePlayers =
      activePlayers.length > 0
        ? activePlayers
        : await this.playerService.getAllPlayers();
    try {
      monstersPruned = await this.monsterService.pruneMonstersFarFromPlayers(
        prunePlayers,
        env.MONSTER_PRUNE_DISTANCE,
      );
      if (monstersPruned > 0) {
        this.logger.debug(
          `Tick ${newTick}: Pruned ${monstersPruned} monster(s) beyond ${env.MONSTER_PRUNE_DISTANCE} tiles from players.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Tick ${newTick}: Failed to prune distant monsters: ${err instanceof Error ? err.message : err}`,
      );
    }

    if (activePlayers.length === 0) {
      this.logger.debug(
        `Tick ${newTick}: No active players detected; skipping monster spawn/move.`,
      );
    } else {
      for (const player of activePlayers) {
        const spawnKey = Number.isFinite(Number(player.id))
          ? `player:${Number(player.id)}`
          : `pos:${player.x}:${player.y}`;
        const lastSpawnTick = this.lastSpawnTickByPlayer.get(spawnKey);
        if (
          typeof lastSpawnTick === 'number' &&
          newTick - lastSpawnTick < env.SPAWN_COOLDOWN_TICKS
        ) {
          this.logger.debug(
            `Tick ${newTick}: Skipping density enforcement for ${spawnKey} (cooldown ${env.SPAWN_COOLDOWN_TICKS} ticks).`,
          );
          continue;
        }
        const { spawned, report } =
          await this.populationService.enforceDensityAround(
            player.x,
            player.y,
            12,
            6,
          );
        monstersSpawned += spawned;
        if (spawned > 0) {
          this.logger.debug(
            `Tick ${newTick}: Spawned ${spawned} monster(s) near player ${player.id} at (${player.x},${player.y}).`,
          );
          this.lastSpawnTickByPlayer.set(spawnKey, newTick);
        }
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
              `Density around (${player.x},${player.y}) -> ${lines}`,
            );
          }
        }
      }

      // 2) Move monsters near active players only, partitioned by ID and capped by budget
      const candidateById = new Map<number, { id: number }>();
      for (const p of activePlayers) {
        const minX = p.x - ACTIVE_RADIUS;
        const maxX = p.x + ACTIVE_RADIUS;
        const minY = p.y - ACTIVE_RADIUS;
        const maxY = p.y + ACTIVE_RADIUS;
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
      if (toAttempt.length === 0) {
        this.logger.debug(
          `Tick ${newTick}: No monsters eligible for movement near active players.`,
        );
      }
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
    }

    // 3) Cleanup/prune world monsters every tick to prevent stale records
    try {
      await this.monsterService.cleanupDeadMonsters();
    } catch (err) {
      this.logger.warn(
        `Tick ${newTick}: Failed to cleanup dead monsters: ${err instanceof Error ? err.message : err}`,
      );
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

    this.logger.debug(
      `Tick ${newTick} summary: spawned=${monstersSpawned}, moved=${monstersMoved}, pruned=${monstersPruned}, weatherUpdated=${weatherUpdated}.`,
    );

    return {
      tick: newTick,
      gameHour: newHour,
      gameDay: newDay,
      monstersSpawned,
      monstersMoved,
      weatherUpdated,
      monstersPruned,
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
}
