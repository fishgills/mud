import { Injectable } from '@nestjs/common';
import { getPrismaClient } from '@mud/database';
import { MonsterService } from '../monster/monster.service';
import { CombatService } from '../combat/combat.service';
import { PlayerService } from '../player/player.service';

export interface TickResult {
  tick: number;
  gameHour: number;
  gameDay: number;
  monstersSpawned: number;
  monstersMoved: number;
  combatEvents: number;
  weatherUpdated: boolean;
}

@Injectable()
export class GameTickService {
  private prisma = getPrismaClient();

  constructor(
    private monsterService: MonsterService,
    private combatService: CombatService,
    private playerService: PlayerService
  ) {}

  async processTick(): Promise<TickResult> {
    // Get or create game state
    let gameState = await this.prisma.gameState.findFirst();
    if (!gameState) {
      gameState = await this.prisma.gameState.create({
        data: { tick: 0, gameHour: 0, gameDay: 1 },
      });
    }

    const newTick = gameState.tick + 1;
    let newHour = gameState.gameHour;
    let newDay = gameState.gameDay;

    // Advance time (each tick is 15 minutes of game time)
    if (newTick % 4 === 0) {
      newHour += 1;
      if (newHour >= 24) {
        newHour = 0;
        newDay += 1;
      }
    }

    // Update game state
    await this.prisma.gameState.update({
      where: { id: gameState.id },
      data: {
        tick: newTick,
        gameHour: newHour,
        gameDay: newDay,
      },
    });

    let monstersSpawned = 0;
    let monstersMoved = 0;
    let combatEvents = 0;
    let weatherUpdated = false;

    // Spawn monsters (5% chance per tick)
    if (Math.random() < 0.05) {
      const players = await this.playerService.getAllPlayers();
      for (const player of players) {
        if (player.isAlive && Math.random() < 0.3) {
          // 30% chance per active player
          const monsters = await this.monsterService.spawnMonstersInArea(
            player.x,
            player.y,
            10
          );
          monstersSpawned += monsters.length;
        }
      }
    }

    // Move monsters
    const monsters = await this.monsterService.getAllMonsters();
    for (const monster of monsters) {
      if (Math.random() < 0.4) {
        // 40% chance for each monster to move
        await this.monsterService.moveMonster(monster.id);
        monstersMoved++;
      }
    }

    // Process monster attacks on players
    for (const monster of monsters) {
      const playersAtLocation = await this.playerService.getPlayersAtLocation(
        monster.x,
        monster.y
      );
      for (const player of playersAtLocation) {
        if (player.isAlive && Math.random() < 0.2) {
          // 20% chance per encounter
          try {
            await this.combatService.monsterAttackPlayer(
              monster.id,
              player.slackId
            );
            combatEvents++;
          } catch (error) {
            // Monster or player might have died or moved
            console.log(
              'Combat failed:',
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
        }
      }
    }

    // Clean up dead monsters every 10 ticks
    if (newTick % 10 === 0) {
      await this.monsterService.cleanupDeadMonsters();
    }

    // Update weather every hour (4 ticks)
    if (newTick % 4 === 0) {
      await this.updateWeather();
      weatherUpdated = true;
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

  private async updateWeather(): Promise<void> {
    let weather = await this.prisma.weatherState.findFirst();

    if (!weather) {
      weather = await this.prisma.weatherState.create({
        data: {
          state: 'clear',
          pressure: 1013, // Standard atmospheric pressure
        },
      });
    }

    // Simple weather system based on pressure changes
    const pressureChange = Math.floor(Math.random() * 20) - 10; // -10 to +10
    const newPressure = Math.max(
      980,
      Math.min(1040, weather.pressure + pressureChange)
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
