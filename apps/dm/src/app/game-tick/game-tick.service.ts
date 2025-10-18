import { Injectable, Logger } from '@nestjs/common';
import { getPrismaClient } from '@mud/database';
import { EventBus } from '@mud/engine';
import { PlayerService } from '../player/player.service';
import { PopulationService } from '../monster/population.service';
import type { TickResult } from '../api';
import { MonsterService } from '../monster/monster.service';

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

    {
      const players = await this.playerService.getAllPlayers();
      for (const player of players) {
        if (!player.combat.isAlive) continue;
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
    }

    const monsters = await this.monsterService.getAllMonsters();
    for (const monster of monsters) {
      if (Math.random() < 0.4) {
        await this.monsterService.moveMonster(monster.id);
        monstersMoved++;
      }
    }

    for (const monster of monsters) {
      const playersAtLocation = await this.playerService.getPlayersAtLocation(
        monster.position.x,
        monster.position.y,
      );
      for (const player of playersAtLocation) {
        if (player.combat.isAlive && Math.random() < 0.2) {
          try {
            const playerIdentifier = this.resolvePlayerIdentifier(player);
            if (!playerIdentifier) {
              console.log('Player has no clientId or slackId, skipping combat');
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
            console.log(
              'Combat failed:',
              error instanceof Error ? error.message : 'Unknown error',
            );
          }
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
