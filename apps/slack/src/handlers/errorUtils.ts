import { COMMANDS } from '../commands';

function extractMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return '';
}

/**
 * Checks if an error is a "player not found" error and returns a user-friendly message
 */
export function handlePlayerNotFoundError(err: unknown): string | null {
  const message = extractMessage(err).toLowerCase();
  if (message.includes('player not found') || message.includes('not found')) {
    return `You don't have a character yet! Use \`${COMMANDS.NEW} CharacterName\` to create one.`;
  }
  return null;
}

/**
 * Gets a user-friendly error message from any error, avoiding exposure of internal IDs
 */
export function getUserFriendlyErrorMessage(
  err: unknown,
  defaultMessage: string,
): string {
  const notFound = handlePlayerNotFoundError(err);
  if (notFound) {
    return notFound;
  }

  const rawMessage = extractMessage(err);
  const safeMessage = rawMessage
    .replace(/Player with slackId.*?already exists/gi, 'Player already exists')
    .replace(/with slackId.*?not found/gi, 'not found')
    .replace(/slackId\s+\w+/gi, 'player')
    .trim();

  return safeMessage || defaultMessage;
}

/**
 * Maps backend error codes (ErrCodes) to user-friendly Slack messages.
 * Returns null when no mapping exists.
 */
export function mapErrCodeToFriendlyMessage(code?: string): string | null {
  if (!code) return null;
  switch (code) {
    case 'INVALID_SLOT':
      return 'That item cannot be equipped to the selected slot.';
    case 'ITEM_NOT_EQUIPPABLE':
      return 'This item cannot be equipped.';
    case 'NOT_OWNED':
      return "You don't own that item.";
    default:
      return null;
  }
}
