/**
 * Convert a Slack user ID to a client ID format
 * @param slackUserId The Slack user ID (e.g., "U123456")
 * @returns The client ID in format "slack:U123456"
 */
export function toClientId(slackUserId: string): string {
  return `slack:${slackUserId}`;
}

/**
 * Extract the Slack user ID from a client ID
 * @param clientId The client ID (e.g., "slack:U123456")
 * @returns The Slack user ID (e.g., "U123456") or null if not a Slack client
 */
export function fromClientId(clientId: string): string | null {
  if (clientId.startsWith('slack:')) {
    const raw = clientId.slice(6);
    return raw.length > 0 ? raw : null;
  }
  return null;
}

export interface SlackIdentifiable {
  slackId?: string | null;
  clientId?: string | null;
}

/**
 * Normalize a Slack identifier that might already include a client prefix
 */
export function resolveSlackUserId(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }
  if (value.startsWith('slack:')) {
    return fromClientId(value);
  }
  return value;
}

/**
 * Resolve a Slack user ID from an entity that carries slackId/clientId fields
 */
export function extractSlackId(entity: SlackIdentifiable): string | null {
  const fromSlackId = resolveSlackUserId(entity.slackId ?? undefined);
  if (fromSlackId) {
    return fromSlackId;
  }
  if (entity.clientId) {
    return resolveSlackUserId(entity.clientId);
  }
  return null;
}
