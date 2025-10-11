import { COMMANDS } from '../commands';

const sanitizeMessage = (message: string): string =>
  message
    .replace(/Player with slackId.*?already exists/gi, 'Player already exists')
    .replace(/with slackId.*?not found/gi, 'not found')
    .replace(/slackId\s+\w+/gi, 'player');

const extractNestedMessage = (input: unknown): string | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }
  if ('message' in input) {
    const value = (input as { message?: unknown }).message;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  if (
    'errors' in input &&
    Array.isArray((input as { errors?: unknown }).errors)
  ) {
    const first = (input as { errors: unknown[] }).errors[0];
    return extractNestedMessage(first);
  }
  return null;
};

const extractErrorMessage = (err: unknown): string | null => {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message;
  }
  if (typeof err === 'string' && err.trim().length > 0) {
    return err;
  }
  if (!err || typeof err !== 'object') {
    return null;
  }

  if ('message' in err) {
    const value = (err as { message?: unknown }).message;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  if ('responseBody' in err) {
    const nested = extractNestedMessage(
      (err as { responseBody?: unknown }).responseBody,
    );
    if (nested) {
      return nested;
    }
  }

  if ('response' in err) {
    const nested = extractNestedMessage(
      (err as { response?: unknown }).response,
    );
    if (nested) {
      return nested;
    }
  }

  return null;
};

export function handlePlayerNotFoundError(err: unknown): string | null {
  if (typeof err === 'string' && err.toLowerCase().includes('not found')) {
    return `You don't have a character yet! Use "${COMMANDS.NEW} CharacterName" to create one.`;
  }

  const message = extractErrorMessage(err);
  if (!message) {
    return null;
  }
  const normalized = message.toLowerCase();
  if (
    normalized.includes('player not found') ||
    normalized.includes('character not found') ||
    normalized.includes('not found')
  ) {
    return `You don't have a character yet! Use "${COMMANDS.NEW} CharacterName" to create one.`;
  }

  return null;
}

export function getUserFriendlyErrorMessage(
  err: unknown,
  defaultMessage: string,
): string {
  const playerMessage = handlePlayerNotFoundError(err);
  if (playerMessage) {
    return playerMessage;
  }

  if (typeof err === 'string') {
    return defaultMessage;
  }

  const message = extractErrorMessage(err);
  if (message && message.trim().length > 0) {
    const safeMessage = sanitizeMessage(message);
    return safeMessage.trim().length > 0 ? safeMessage : defaultMessage;
  }

  return defaultMessage;
}
