import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';
import type { HandlerContext } from './types';

export class ContinueRunHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.CONTINUE, 'Unable to continue the run');
  }

  protected async perform({ teamId, userId, say }: HandlerContext) {
    const result = await this.dm.continueRun({ teamId, userId });
    if (!result.success) {
      await say({ text: result.message ?? 'Unable to continue the run.' });
      return;
    }

    await say({
      text: 'Continuing the run. Check your DMs for the next round.',
    });
  }
}

export const continueRunHandler = new ContinueRunHandler();
