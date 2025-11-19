import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AnnouncementRecord } from '@mud/database';
import type {
  GuildAnnouncementPayload,
  GuildAnnouncementPollRequest,
} from '@mud/api-contracts';
import { withGuildLogFields } from '@mud/logging';
import { GuildAnnouncementsRepository } from './guild-announcements.repository';
import { GuildAnnouncementsPublisher } from './guild-announcements.publisher';
import { CoordinationService } from '../../shared/coordination.service';
import { recordGuildAnnouncementMetric } from './guild-announcements.metrics';

export interface AnnouncementPollResult {
  delivered: boolean;
  announcement?: AnnouncementRecord;
  correlationId?: string;
}

type PollSource = 'tick' | 'manual';

const CLUSTER_LOCK_KEY = 'guild:announcements:poll';
const CLUSTER_LOCK_TTL_MS = 15_000;

@Injectable()
export class GuildAnnouncementsService {
  private readonly logger = new Logger(GuildAnnouncementsService.name);
  private pollInFlight = false;

  constructor(
    private readonly repository: GuildAnnouncementsRepository,
    private readonly publisher: GuildAnnouncementsPublisher,
    private readonly coordination: CoordinationService,
  ) {}

  async pollNextAnnouncement(
    source: PollSource = 'tick',
    request?: GuildAnnouncementPollRequest,
  ): Promise<AnnouncementPollResult> {
    if (this.pollInFlight) {
      this.logger.debug(
        `Poll skipped - previous run still in progress (${source})`,
      );
      return { delivered: false };
    }

    const distributedLockEnabled = this.coordination.isEnabled();
    const lockToken = distributedLockEnabled ? randomUUID() : null;
    if (distributedLockEnabled) {
      const acquired = await this.coordination.acquireLock(
        CLUSTER_LOCK_KEY,
        lockToken!,
        CLUSTER_LOCK_TTL_MS,
      );
      if (!acquired) {
        this.logger.verbose(
          `Skipped guild announcement polling (${source}); another worker holds the lock.`,
        );
        return { delivered: false };
      }
    }

    const startedAt = Date.now();
    const correlationId = randomUUID();
    this.pollInFlight = true;
    try {
      const announcement = await this.repository.fetchNextEligible();
      if (!announcement) {
        this.logger.debug(
          withGuildLogFields(
            {
              message: 'No eligible guild announcements found',
              source,
              requestMetadata: request ?? null,
            },
            { command: 'announce', correlationId },
          ),
        );
        recordGuildAnnouncementMetric(
          { command: 'announce', correlationId },
          Date.now() - startedAt,
          'skipped',
        );
        return { delivered: false };
      }

      await this.repository.markAsAnnounced(announcement.id);

      const [occupants, digestRecipients] = await Promise.all([
        this.repository.getGuildOccupants(),
        this.repository.getDigestRecipients(),
      ]);

      const payload = this.toPayload(announcement);

      await this.publisher.publish({
        announcement: payload,
        raw: announcement,
        occupants,
        digestRecipients,
        correlationId,
        source,
      });

      recordGuildAnnouncementMetric(
        { command: 'announce', correlationId },
        Date.now() - startedAt,
        'delivered',
      );

      return { delivered: true, announcement, correlationId };
    } catch (error) {
      this.logger.error(
        withGuildLogFields(
          { message: 'Guild announcement polling failed', source, request },
          { command: 'announce', correlationId },
        ),
        error as Error,
      );
      recordGuildAnnouncementMetric(
        { command: 'announce', correlationId },
        Date.now() - startedAt,
        'failed',
      );
      return { delivered: false };
    } finally {
      this.pollInFlight = false;
      if (distributedLockEnabled && lockToken) {
        await this.coordination.releaseLock(CLUSTER_LOCK_KEY, lockToken);
      }
    }
  }

  private toPayload(record: AnnouncementRecord): GuildAnnouncementPayload {
    return {
      id: record.id.toString(),
      title: record.title,
      body: record.body,
      digest: record.digest,
      priority: record.priority,
      visibleUntil: record.visibleUntil?.toISOString(),
    };
  }
}
