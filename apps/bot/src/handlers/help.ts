import { HandlerContext } from './types';
import { moveHandlerHelp } from './move';
import { attackHandlerHelp } from './attack';
import { createHandlerHelp } from './create';
import { rerollHandlerHelp } from './reroll';
import { completeHandlerHelp } from './complete';

const EMOJI_HELP = ':information_source:';
export const helpHandlerHelp = `Show instructions for using the bot with ${EMOJI_HELP}.`;
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
