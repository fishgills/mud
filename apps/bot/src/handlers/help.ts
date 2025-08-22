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

export const helpHandlerHelp = `Show instructions for using the bot with "help".`;

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
    `• Send "help" to see these instructions`,
    '',
    '💡 **Getting Started:**',
    '1. Create a character with "new YourName"',
    '2. Reroll stats if needed with "reroll"',
    '3. Complete creation with "complete"',
    '4. Start exploring with direction words like "north" or "up"!',
  ].join('\n');
  await say({ text: helpMsg });
};

// Register help handler for text command only
registerHandler('help', helpHandler);
