import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';
import type { HandlerContext } from './types';

export class SellHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.SELL, 'Sale failed');
  }

  protected async perform({ say }: HandlerContext) {
    await say({
      text: `Use the \`${COMMANDS.INVENTORY}\` sell buttons while inside the guild.`,
    });
  }
}

export const sellHandler = new SellHandler();
