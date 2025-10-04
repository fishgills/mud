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
    return clientId.slice(6);
  }
  return null;
}
