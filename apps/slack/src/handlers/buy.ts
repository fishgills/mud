import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';
import type { HandlerContext } from './types';

const usage = `Use "${COMMANDS.BUY} <item>" while inside the guild hall.`;

export class BuyHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.BUY, 'Purchase failed');
  }

  protected async perform({ teamId, userId, text, say }: HandlerContext) {
    if (!this.player?.isInHq) {
      await say({ text: 'Teleport to the guild first before buying items.' });
      return;
    }
    const [, ...tokens] = text.trim().split(/\s+/);
    if (tokens.length === 0) {
      await say({ text: usage });
      return;
    }
    const item = tokens.join(' ');
    const response = await this.dm.guildBuyItem({ teamId, userId, item });

    if (!response?.receiptId) {
      await say({ text: 'Purchase failed. Confirm the item is in stock.' });
      return;
    }

    const cost = Math.abs(response.goldDelta ?? 0);
    await say({
      text: `🛒 Purchased ${item} for ${cost} gold. Remaining gold: ${response.remainingGold}.`,
    });
  }
}

export const buyHandler = new BuyHandler();
