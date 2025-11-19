import { Injectable } from '@nestjs/common';
import {
  AnnouncementStatus,
  getPrismaClient,
  type AnnouncementRecord,
} from '@mud/database';

@Injectable()
export class GuildAnnouncementsRepository {
  private readonly prisma = getPrismaClient();

  async fetchNextEligible(
    now = new Date(),
  ): Promise<AnnouncementRecord | null> {
    return this.prisma.announcementRecord.findFirst({
      where: {
        status: AnnouncementStatus.PENDING,
        visibleFrom: { lte: now },
        OR: [{ visibleUntil: null }, { visibleUntil: { gt: now } }],
      },
      orderBy: [{ priority: 'desc' }, { visibleFrom: 'asc' }, { id: 'asc' }],
    });
  }

  async markAsAnnounced(id: number, timestamp = new Date()): Promise<void> {
    await this.prisma.announcementRecord.update({
      where: { id },
      data: {
        status: AnnouncementStatus.ANNOUNCED,
        lastAnnouncedAt: timestamp,
        updatedAt: timestamp,
      },
    });
  }

  async getGuildOccupants(): Promise<
    Array<{ teamId: string; userId: string }>
  > {
    const players = await this.prisma.player.findMany({
      where: {
        isInHq: true,
        slackUser: { isNot: null },
      },
      select: {
        slackUser: {
          select: {
            teamId: true,
            userId: true,
          },
        },
      },
    });

    return players
      .map((record) => record.slackUser)
      .filter((slack): slack is NonNullable<typeof slack> => Boolean(slack));
  }

  async getDigestRecipients(): Promise<
    Array<{ teamId: string; userId: string }>
  > {
    const players = await this.prisma.player.findMany({
      where: {
        isInHq: false,
        slackUser: { isNot: null },
      },
      select: {
        slackUser: {
          select: {
            teamId: true,
            userId: true,
          },
        },
      },
    });

    return players
      .map((record) => record.slackUser)
      .filter((slack): slack is NonNullable<typeof slack> => Boolean(slack));
  }
}
