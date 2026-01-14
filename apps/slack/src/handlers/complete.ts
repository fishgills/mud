import { COMMANDS } from '../commands';
import { HandlerContext } from './types';
import { PlayerCommandHandler } from './base';

export const completeHandlerHelp = `Complete your character creation with "complete". Example: Send "complete" when you are done creating your character.`;

export class CompleteHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.COMPLETE, 'Failed to complete character', {
      allowDuringCreation: true,
    });
  }

  protected async perform({ userId, say }: HandlerContext): Promise<void> {
    const response = await this.dm.completePlayer({
      teamId: this.teamId!,
      userId,
    });
    if (response.success) {
      await say({
        text: `✅ Character creation complete! You can now start a raid and gear up.`,
      });
      return;
    }

    await say({ text: `Error: ${response.message}` });
  }
}

export const completeHandler = new CompleteHandler();
