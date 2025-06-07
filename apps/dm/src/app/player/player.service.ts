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

  async getNearbyPlayers(
    currentX: number,
    currentY: number,
    excludeSlackId?: string,
    radius = Infinity,
    limit = 10
  ): Promise<
    Array<{ distance: number; direction: string; x: number; y: number }>
  > {
    // Get all players (or within bounding box if radius is finite)
    const whereClause: {
      isAlive: boolean;
      slackId?: { not: string };
      x?: { gte: number; lte: number };
      y?: { gte: number; lte: number };
    } = {
      isAlive: true,
      ...(excludeSlackId && { slackId: { not: excludeSlackId } }),
    };

    // Only add spatial constraints if radius is finite
    if (radius !== Infinity) {
      whereClause.x = { gte: currentX - radius, lte: currentX + radius };
      whereClause.y = { gte: currentY - radius, lte: currentY + radius };
    }

    const players = await this.prisma.player.findMany({
      where: whereClause,
    });

    // Calculate actual distance and filter by circular radius
    const playersWithDistance = players
      .map((player) => {
        const distance = Math.sqrt(
          (player.x - currentX) ** 2 + (player.y - currentY) ** 2
        );
        const direction = this.calculateDirection(
          currentX,
          currentY,
          player.x,
          player.y
        );
        return {
          distance: Math.round(distance * 10) / 10,
          direction,
          x: player.x,
          y: player.y,
        };
      })
      .filter((player) => radius === Infinity || player.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return playersWithDistance;
  }

  private calculateDirection(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): string {
    const dx = toX - fromX;
    const dy = toY - fromY;

    // Calculate angle in radians, then convert to degrees
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Normalize angle to 0-360 range
    const normalizedAngle = (angle + 360) % 360;

    // Convert to compass direction
    if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'east';
    if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'northeast';
    if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'north';
    if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'northwest';
    if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'west';
    if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'southwest';
    if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'south';
    return 'southeast';
  }
}
