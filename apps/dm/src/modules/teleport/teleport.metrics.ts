import { Logger } from '@nestjs/common';
import { formatGuildMetricTags, type GuildLogContext } from '@mud/logging';

const metricsLogger = new Logger('GuildTeleportMetrics');

export const recordGuildTeleportMetric = (
  context: GuildLogContext,
  durationMs: number,
): void => {
  metricsLogger.debug({
    event: 'guild.teleport.metric',
    durationMs,
    tags: formatGuildMetricTags(context),
  });
};
