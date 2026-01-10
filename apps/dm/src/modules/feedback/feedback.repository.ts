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
    this.logger.debug(
      `[FEEDBACK-REPO] Creating feedback: playerId=${data.playerId}, type=${data.type}, status=${data.status}`,
    );
    const result = await getPrismaClient().feedback.create({
      data,
    });
    this.logger.debug(`[FEEDBACK-REPO] Created feedback with id=${result.id}`);
    return result;
  }

  async findByPlayerId(playerId: number, limit = 5) {
    this.logger.debug(
      `[FEEDBACK-REPO] Finding feedback for playerId=${playerId}, limit=${limit}`,
    );
    const results = await getPrismaClient().feedback.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    this.logger.debug(
      `[FEEDBACK-REPO] Found ${results.length} feedback records`,
    );
    return results;
  }

  async findById(id: number) {
    this.logger.debug(`[FEEDBACK-REPO] Finding feedback by id=${id}`);
    return getPrismaClient().feedback.findUnique({
      where: { id },
    });
  }

  async delete(id: number) {
    this.logger.debug(`[FEEDBACK-REPO] Deleting feedback id=${id}`);
    return getPrismaClient().feedback.delete({
      where: { id },
    });
  }

  async countRecentByPlayerId(
    playerId: number,
    sinceMs: number = 60 * 60 * 1000, // 1 hour
  ) {
    const since = new Date(Date.now() - sinceMs);
    this.logger.debug(
      `[FEEDBACK-REPO] Counting recent feedback for playerId=${playerId} since ${since.toISOString()}`,
    );
    const count = await getPrismaClient().feedback.count({
      where: {
        playerId,
        createdAt: { gte: since },
      },
    });
    this.logger.debug(`[FEEDBACK-REPO] Recent feedback count: ${count}`);
    return count;
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
    this.logger.debug(
      `[FEEDBACK-REPO] Updating feedback id=${id} to status=${status}`,
    );
    return getPrismaClient().feedback.update({
      where: { id },
      data: {
        status,
        ...updates,
      },
    });
  }
}
