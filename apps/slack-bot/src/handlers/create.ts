import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';
import { buildPlayerStatsMessage } from './stats/format';

export const createHandlerHelp = `Create a new character with "new". Example: Send "new AwesomeDude" to create a character named AwesomeDude.`;

export const createHandler = async ({ userId, say, text }: HandlerContext) => {
  // Parse the character name from the message
  const trimmedText = text.trim();
  const parts = trimmedText.split(/\s+/);

  // Find the "new" command and extract everything after it as the name
  let name = '';
  const newIndex = parts.findIndex(
    (part) => part.toLowerCase() === COMMANDS.NEW,
  );
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
      const introText = `Welcome <@${userId}>! Your character creation has started.`;
      const instructions =
        'Use "reroll" to reroll your stats, and "complete" when you are done.';
      const statsMessage = buildPlayerStatsMessage(result.createPlayer.data, {
        isSelf: true,
      });
      await say({
        text: `${introText} ${instructions} ${statsMessage.text}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${introText}\n${instructions}`,
            },
          },
          { type: 'divider' },
          ...statsMessage.blocks,
        ],
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
registerHandler(COMMANDS.NEW, createHandler);
