export const formatWebRecipientId = (teamId: string, userId: string): string =>
  `web:${teamId}:${userId}`;
