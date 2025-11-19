export interface GuildLogContext {
  correlationId?: string;
  playerId?: number | string;
  slackUserId?: string;
  command?: 'guild' | 'buy' | 'sell' | 'announce';
  extra?: Record<string, unknown>;
}

export const withGuildLogFields = <T extends Record<string, unknown>>(
  payload: T,
  context: GuildLogContext = {},
): T & { guild: GuildLogContext } => ({
  ...payload,
  guild: {
    correlationId: context.correlationId,
    playerId: context.playerId,
    slackUserId: context.slackUserId,
    command: context.command,
    extra: context.extra,
  },
});

export const formatGuildMetricTags = (context: GuildLogContext): string[] => {
  const tags: string[] = [];
  if (context.command) tags.push(`command:${context.command}`);
  if (context.playerId) tags.push(`player:${context.playerId}`);
  if (context.correlationId) tags.push(`correlation:${context.correlationId}`);
  return tags;
};
