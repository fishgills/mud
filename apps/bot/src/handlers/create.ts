import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { formatPlayerStats } from './stats';

export const EMOJI_CREATE = ':new:';
export const EMOJI_REROLL = ':game_die:';
export const EMOJI_COMPLETE = ':white_check_mark:';

export const createHandlerHelp = `Create a new character with ${EMOJI_CREATE}. Example: Send ${EMOJI_CREATE} to start character creation.`;
export const createHandler = async ({ userId, say }: HandlerContext) => {
  const name = `Player_${userId}`;
  const input = { slackId: userId, name };
  try {
    const result = await dmSdk.CreatePlayer({ input });
    if (result.createPlayer.success && result.createPlayer.data) {
      const statsMsg = formatPlayerStats(result.createPlayer.data);
      await say({
        text: `Welcome <@${userId}>! Your character creation has started.\n${statsMsg}\nSend ${EMOJI_REROLL} to reroll your stats, and ${EMOJI_COMPLETE} when you are done.`,
      });
    } else {
      console.log('CreatePlayer error:', result.createPlayer);
      await say({ text: `Error: ${result.createPlayer.message}` });
    }
  } catch (err: any) {
    // Check for GraphQL errors from graphql-request
    if (err?.response?.errors) {
      const playerExists = err.response.errors.find(
        (e: any) => e.extensions?.code === 'PLAYER_EXISTS',
      );
      if (playerExists) {
        await say({ text: `You already have a character!` });
        return;
      }
      // Handle other GraphQL errors
      await say({
        text: `Failed to create character: ${err.response.errors[0].message}`,
      });
    } else {
      // Handle network or unexpected errors
      await say({ text: `Failed to create character: ${err.message || err}` });
    }
  }
};

// Register handler after all declarations
registerHandler(EMOJI_CREATE, createHandler);
