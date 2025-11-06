/**
 * Convert a Slack user ID to a client ID format
 * @param slackUserId The Slack user ID (e.g., "U123456")
 * @param teamId Workspace team ID (e.g., "T123456")
 * @returns The client ID in format "slack:T123456:U123456" (workspace-qualified)
 */
export function toClientId(slackUserId: string, teamId?: string): string {
  return `slack:${teamId || ''}:${slackUserId}`;
}

/**
 * Extract the Slack user ID from a client ID
 * @param clientId The client ID (e.g., "slack:U123456")
 * @returns The Slack user ID (e.g., "U123456") or null if not a Slack client
 */
export function fromClientId(clientId: string): string | null {
  if (!clientId) {
    return null;
  }

  let raw = clientId.trim();
  const prefix = 'slack:';

  while (raw.startsWith(prefix)) {
    raw = raw.slice(prefix.length);
  }

  return raw.length > 0 ? raw : null;
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
    const extracted = fromClientId(value);
    return extracted && extracted.length > 0 ? extracted : null;
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
