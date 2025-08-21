/**
 * Utility functions for handling errors in a user-friendly way
 */

export interface GraphQLErrorResponse {
  response?: {
    errors?: Array<{
      message: string;
      extensions?: { code?: string };
    }>;
  };
}

/**
 * Checks if an error is a "player not found" error and returns a user-friendly message
 */
export function handlePlayerNotFoundError(err: unknown): string | null {
  // Check for GraphQL errors
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'errors' in err.response
  ) {
    const graphqlErr = err as GraphQLErrorResponse;
    const errors = graphqlErr.response?.errors;

    if (errors) {
      const notFoundError = errors.find(
        (e) =>
          e.message.toLowerCase().includes('not found') ||
          e.message.toLowerCase().includes('player not found'),
      );

      if (notFoundError) {
        return `You don't have a character yet! Use :new: CharacterName to create one.`;
      }
    }
  }

  // Check for simple error messages
  if (err instanceof Error && err.message.toLowerCase().includes('not found')) {
    return `You don't have a character yet! Use :new: CharacterName to create one.`;
  }

  return null; // Not a player not found error
}

/**
 * Gets a user-friendly error message from any error, avoiding exposure of internal IDs
 */
export function getUserFriendlyErrorMessage(
  err: unknown,
  defaultMessage: string,
): string {
  // First check if it's a player not found error
  const playerNotFoundMsg = handlePlayerNotFoundError(err);
  if (playerNotFoundMsg) {
    return playerNotFoundMsg;
  }

  // Handle GraphQL errors
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'errors' in err.response
  ) {
    const graphqlErr = err as GraphQLErrorResponse;
    const errors = graphqlErr.response?.errors;

    if (errors && errors.length > 0) {
      // Filter out any messages that might contain sensitive info like slackId
      const safeMessage = errors[0].message
        .replace(/slackId\s+\w+/gi, 'player') // Remove slackId references
        .replace(/with slackId.*?not found/gi, 'not found') // Clean up not found messages
        .replace(
          /Player with slackId.*?already exists/gi,
          'Player already exists',
        );

      return safeMessage || defaultMessage;
    }
  }

  // Handle regular errors
  if (err instanceof Error) {
    const safeMessage = err.message
      .replace(/slackId\s+\w+/gi, 'player') // Remove slackId references
      .replace(/with slackId.*?not found/gi, 'not found') // Clean up not found messages
      .replace(
        /Player with slackId.*?already exists/gi,
        'Player already exists',
      );

    return safeMessage || defaultMessage;
  }

  return defaultMessage;
}
