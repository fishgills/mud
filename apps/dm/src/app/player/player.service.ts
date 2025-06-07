import { Injectable, NotFoundException } from '@nestjs/common';
import { getPrismaClient, Player } from '@mud/database';
import {
  CreatePlayerDto,
  MovePlayerDto,
  PlayerStatsDto,
} from './dto/player.dto';

@Injectable()
export class PlayerService {
  private prisma = getPrismaClient();

  async createPlayer(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const { slackId, name, x = 0, y = 0 } = createPlayerDto;

    // Check if player already exists
    const existingPlayer = await this.prisma.player.findUnique({
      where: { slackId },
    });

    if (existingPlayer) {
      return existingPlayer;
    }

    // Generate random starting stats (8-15 range)
    const strength = Math.floor(Math.random() * 8) + 8;
    const agility = Math.floor(Math.random() * 8) + 8;
    const health = Math.floor(Math.random() * 8) + 8;

    // Calculate max HP based on health attribute
    const maxHp = 80 + health * 2;

    return this.prisma.player.create({
      data: {
        slackId,
        name,
        x,
        y,
        hp: maxHp,
        maxHp,
        strength,
        agility,
        health,
        level: 1,
        isAlive: true,
      },
    });
  }

  async getPlayer(slackId: string): Promise<Player> {
    const player = await this.prisma.player.findUnique({
      where: { slackId },
      include: {
        worldTile: {
          include: {
            biome: true,
            monsters: {
              where: { isAlive: true },
            },
          },
        },
      },
    });

    if (!player) {
      throw new NotFoundException(`Player with slackId ${slackId} not found`);
    }

    return player;
  }

  async getAllPlayers(): Promise<Player[]> {
    return this.prisma.player.findMany({
      where: { isAlive: true },
      include: {
        worldTile: {
          include: {
            biome: true,
          },
        },
      },
    });
  }

  async movePlayer(slackId: string, moveDto: MovePlayerDto): Promise<Player> {
    const player = await this.getPlayer(slackId);

    let newX = player.x;
    let newY = player.y;

    switch (moveDto.direction.toLowerCase()) {
      case 'n':
      case 'north':
        newY -= 1;
        break;
      case 's':
      case 'south':
        newY += 1;
        break;
      case 'e':
      case 'east':
        newX += 1;
        break;
      case 'w':
      case 'west':
        newX -= 1;
        break;
      default:
        throw new Error('Invalid direction. Use n, s, e, w');
    }

    return this.prisma.player.update({
      where: { slackId },
      data: {
        x: newX,
        y: newY,
        lastAction: new Date(),
      },
      include: {
        worldTile: {
          include: {
            biome: true,
            monsters: {
              where: { isAlive: true },
            },
          },
        },
      },
    });
  }

  async updatePlayerStats(
    slackId: string,
    statsDto: PlayerStatsDto
  ): Promise<Player> {
    return this.prisma.player.update({
      where: { slackId },
      data: {
        hp: statsDto.hp,
        xp: statsDto.xp,
        gold: statsDto.gold,
        level: statsDto.level,
        updatedAt: new Date(),
      },
    });
  }

  async healPlayer(slackId: string, amount: number): Promise<Player> {
    const player = await this.getPlayer(slackId);
    const newHp = Math.min(player.hp + amount, player.maxHp);

    return this.prisma.player.update({
      where: { slackId },
      data: { hp: newHp },
    });
  }

  async damagePlayer(slackId: string, damage: number): Promise<Player> {
    const player = await this.getPlayer(slackId);
    const newHp = Math.max(player.hp - damage, 0);
    const isAlive = newHp > 0;

    return this.prisma.player.update({
      where: { slackId },
      data: {
        hp: newHp,
        isAlive,
      },
    });
  }

  async respawnPlayer(slackId: string): Promise<Player> {
    const player = await this.getPlayer(slackId);

    return this.prisma.player.update({
      where: { slackId },
      data: {
        hp: player.maxHp,
        isAlive: true,
        x: 0, // Respawn at origin
        y: 0,
      },
    });
  }

  async getPlayersAtLocation(x: number, y: number): Promise<Player[]> {
    return this.prisma.player.findMany({
      where: {
        x,
        y,
        isAlive: true,
      },
    });
  }
}
