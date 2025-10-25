import { COMMANDS } from '../commands';
import { HandlerContext } from './types';
import { PlayerCommandHandler } from './base';

export const completeHandlerHelp = `Complete your character creation with "complete". Example: Send "complete" when you are done creating your character.`;

export class CompleteHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.COMPLETE, 'Failed to complete character');
  }

  protected async perform({ userId, say }: HandlerContext): Promise<void> {
    const result = await this.dm.completePlayer({
      slackId: this.toClientId(userId),
    });
    if (result.success) {
      await say({
        text: `✅ Character creation complete! You can now move and attack.`,
      });
      return;
    }

    await say({ text: `Error: ${result.message}` });
  }
}

export const completeHandler = new CompleteHandler();
