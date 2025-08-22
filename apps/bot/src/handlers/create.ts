import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { formatPlayerStats } from './stats';
import { getUserFriendlyErrorMessage } from './errorUtils';

export const createHandlerHelp = `Create a new character with "new". Example: Send "new AwesomeDude" to create a character named AwesomeDude.`;

export const createHandler = async ({ userId, say, text }: HandlerContext) => {
  // Parse the character name from the message
  const trimmedText = text.trim();
  const parts = trimmedText.split(/\s+/);

  // Find the "new" command and extract everything after it as the name
  let name = '';
  const newIndex = parts.findIndex((part) => part.toLowerCase() === 'new');
  if (newIndex !== -1 && parts.length > newIndex + 1) {
    // Join all parts after "new" as the character name
    name = parts
      .slice(newIndex + 1)
      .join(' ')
      .trim();
  }

  // Check if name was provided
  if (!name) {
    await say({
      text: `Please provide a name for your character! Example: "new AwesomeDude"`,
    });
    return;
  }

  const input = { slackId: userId, name };
  try {
    const result = await dmSdk.CreatePlayer({ input });
    if (result.createPlayer.success && result.createPlayer.data) {
      const statsMsg = formatPlayerStats(result.createPlayer.data);
      await say({
        text: `Welcome <@${userId}>! Your character creation has started.\n${statsMsg}\nSend "reroll" to reroll your stats, and "complete" when you are done.`,
      });
    } else {
      console.log('CreatePlayer error:', result.createPlayer);
      await say({ text: `Error: ${result.createPlayer.message}` });
    }
  } catch (err: unknown) {
    // Check for GraphQL errors from graphql-request
    if (
      err &&
      typeof err === 'object' &&
      'response' in err &&
      err.response &&
      typeof err.response === 'object' &&
      'errors' in err.response
    ) {
      const errors = err.response.errors as Array<{
        extensions?: { code?: string };
        message: string;
      }>;
      const playerExists = errors.find(
        (e) => e.extensions?.code === 'PLAYER_EXISTS',
      );
      if (playerExists) {
        await say({ text: `You already have a character!` });
        return;
      }
      // Handle other GraphQL errors
      const errorMessage = getUserFriendlyErrorMessage(
        err,
        'Failed to create character',
      );
      await say({ text: errorMessage });
    } else {
      // Handle network or unexpected errors
      const errorMessage = getUserFriendlyErrorMessage(
        err,
        'Failed to create character',
      );
      await say({ text: errorMessage });
    }
  }
};

// Register handler for text command only
registerHandler('new', createHandler);
