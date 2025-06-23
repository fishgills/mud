import { HandlerContext } from './types';
import { EMOJI_HELP } from './emojis';
import { moveHandlerHelp } from './move';
import { attackHandlerHelp } from './attack';
import { createHandlerHelp } from './create';
import { rerollHandlerHelp } from './reroll';
import { completeHandlerHelp } from './complete';

export const helpHandlerHelp = `Show instructions for using the bot with ℹ️.`;
export const helpHandler = async ({ say }: HandlerContext) => {
  const helpMsg = [
    'Bot Instructions:',
    '',
    moveHandlerHelp,
    attackHandlerHelp,
    createHandlerHelp,
    rerollHandlerHelp,
    completeHandlerHelp,
    '',
    `Send ${EMOJI_HELP} at any time to see these instructions.`,
  ].join('\n');
  await say({ text: helpMsg });
};
