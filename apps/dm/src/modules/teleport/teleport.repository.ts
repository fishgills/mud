import { Injectable } from '@nestjs/common';
import { getPrismaClient, type Player } from '@mud/database';
import type { GuildHall, PlayerGuildState } from '@prisma/client';
import type { Prisma } from '@prisma/client';

@Injectable()
export class TeleportRepository {
  protected readonly prisma = getPrismaClient();

  async getGuildHall(): Promise<GuildHall | null> {
    return this.prisma.guildHall.findFirst();
  }

  async getPlayerState(playerId: number): Promise<PlayerGuildState | null> {
    return this.prisma.playerGuildState.findUnique({ where: { playerId } });
  }

  async upsertPlayerState(
    playerId: number,
    data: Partial<PlayerGuildState>,
  ): Promise<PlayerGuildState> {
    return this.prisma.playerGuildState.upsert({
      where: { playerId },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        playerId,
        lastTeleportAt: data.lastTeleportAt ?? null,
        cooldownExpiresAt: data.cooldownExpiresAt ?? null,
        lastGuildLocation: data.lastGuildLocation ?? null,
      },
    });
  }

  async movePlayerToGuild(
    player: Player,
    guild: GuildHall,
  ): Promise<{ updatedPlayer: Player; occupants: number[] }> {
    const occupantPlayers = await this.prisma.player.findMany({
      where: {
        isInHq: true,
        id: { not: player.id },
      },
      select: { id: true },
    });

    const occupants = occupantPlayers.map((p) => p.id);

    const coords = (guild.tileCoordinates ?? {}) as Record<string, unknown>;
    const data: Prisma.PlayerUpdateInput = {
      isInHq: true,
      lastHqEnterAt: new Date(),
      lastWorldX: player.x,
      lastWorldY: player.y,
      lastAction: new Date(),
    };

    if (typeof coords.x === 'number') {
      data.x = coords.x;
    }
    if (typeof coords.y === 'number') {
      data.y = coords.y;
    }

    const updatedPlayer = await this.prisma.player.update({
      where: { id: player.id },
      data,
    });

    return { updatedPlayer, occupants };
  }
}
