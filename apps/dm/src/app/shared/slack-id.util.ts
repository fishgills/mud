/**
 * Normalizes a Slack ID by removing the 'slack:' prefix if present.
 * This ensures compatibility between legacy unprefixed IDs (e.g., 'U123')
 * and newer prefixed IDs (e.g., 'slack:U123').
 *
 * @param slackId - The Slack ID to normalize, which may or may not have the 'slack:' prefix
 * @returns The normalized Slack ID without the 'slack:' prefix
 *
 * @example
 * normalizeSlackId('slack:U123') // Returns 'U123'
 * normalizeSlackId('U123') // Returns 'U123'
 */
export function normalizeSlackId(slackId: string): string {
  if (slackId.startsWith('slack:')) {
    return slackId.substring(6); // Remove 'slack:' prefix (6 characters)
  }
  return slackId;
}
