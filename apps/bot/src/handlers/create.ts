import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';

const EMOJI_REROLL = ':game_die:';
export const EMOJI_CREATE = ':new:';
const EMOJI_COMPLETE = ':white_check_mark:';

export const createHandlerHelp = `Create a new character with ${EMOJI_CREATE}. Example: Send ${EMOJI_CREATE} to start character creation.`;
export const createHandler = async ({ userId, say }: HandlerContext) => {
  const name = `Player_${userId}`;
  const input = { slackId: userId, name };
  try {
    const result = await dmSdk.CreatePlayer({ input });
    if (result.createPlayer.success) {
      await say({
        text: `Welcome <@${userId}>! Your character creation has started. Send ${EMOJI_REROLL} to reroll your stats, and ${EMOJI_COMPLETE} when you are done.`,
      });
    } else {
      await say({ text: `Error: ${result.createPlayer.message}` });
    }
  } catch (err) {
    await say({ text: `Failed to create character: ${err}` });
  }
};

// Register handler after all declarations
registerHandler(EMOJI_CREATE, createHandler);
