import { HandlerContext } from './types';
import { moveHandlerHelp } from './move';
import { lookHandlerHelp } from './look';
import { attackHandlerHelp } from './attack';
import { createHandlerHelp } from './create';
import { rerollHandlerHelp } from './reroll';
import { completeHandlerHelp } from './complete';
import { deleteHandlerHelp } from './delete';
import { statsHandlerHelp } from './stats';
import { mapHandlerHelp } from './map';
import { registerHandler } from './handlerRegistry';

const EMOJI_HELP = ':information_source:';
export const helpHandlerHelp = `Show instructions for using the bot with ${EMOJI_HELP} or "help".`;

export const helpHandler = async ({ say }: HandlerContext) => {
  const helpMsg = [
    '🎮 **MUD Bot Commands**',
    '',
    '**Character Creation:**',
    `• ${createHandlerHelp}`,
    `• ${rerollHandlerHelp}`,
    `• ${completeHandlerHelp}`,
    `• ${deleteHandlerHelp}`,
    '',
    '**Game Actions:**',
    `• ${moveHandlerHelp}`,
    `• ${lookHandlerHelp}`,
    `• ${attackHandlerHelp}`,
    `• ${statsHandlerHelp}`,
    '',
    '**Other Commands:**',
    `• ${mapHandlerHelp}`,
    `• Send "help" or ${EMOJI_HELP} to see these instructions`,
    '',
    '💡 **Getting Started:**',
    '1. Create a character with `:new: YourName`',
    '2. Reroll stats if needed with `:game_die:`',
    '3. Complete creation with `:white_check_mark:`',
    '4. Start exploring with arrow emojis or directions!',
  ].join('\n');
  await say({ text: helpMsg });
};

// Register help handlers
registerHandler(EMOJI_HELP, helpHandler);
registerHandler('help', helpHandler);
