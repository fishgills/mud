import { Logger } from '@nestjs/common';
import { formatGuildMetricTags, type GuildLogContext } from '@mud/logging';

const metricsLogger = new Logger('GuildAnnouncementsMetrics');

export const recordGuildAnnouncementMetric = (
  context: GuildLogContext,
  durationMs: number,
  outcome: 'delivered' | 'failed' | 'skipped',
): void => {
  metricsLogger.debug({
    event: 'guild.announcement.metric',
    outcome,
    durationMs,
    tags: formatGuildMetricTags({ ...context, command: 'announce' }),
  });
};
