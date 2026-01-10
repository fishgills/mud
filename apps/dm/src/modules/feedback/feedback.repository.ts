import { Injectable, Logger } from '@nestjs/common';
import { getPrismaClient } from '@mud/database';

@Injectable()
export class FeedbackRepository {
  private readonly logger = new Logger(FeedbackRepository.name);

  async create(data: {
    playerId: number;
    type: string;
    content: string;
    category?: string;
    priority?: string;
    summary?: string;
    status: string;
    rejectionReason?: string;
    githubIssueUrl?: string;
    githubIssueNum?: number;
  }) {
    return getPrismaClient().feedback.create({
      data,
    });
  }

  async findByPlayerId(playerId: number, limit = 5) {
    return getPrismaClient().feedback.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async countRecentByPlayerId(
    playerId: number,
    sinceMs: number = 60 * 60 * 1000, // 1 hour
  ) {
    const since = new Date(Date.now() - sinceMs);
    return getPrismaClient().feedback.count({
      where: {
        playerId,
        createdAt: { gte: since },
      },
    });
  }

  async updateStatus(
    id: number,
    status: string,
    updates?: {
      githubIssueUrl?: string;
      githubIssueNum?: number;
      rejectionReason?: string;
    },
  ) {
    return getPrismaClient().feedback.update({
      where: { id },
      data: {
        status,
        ...updates,
      },
    });
  }
}
