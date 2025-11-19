import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';
import type { HandlerContext } from './types';

const usage = `Use "${COMMANDS.SELL} <item>" while inside the guild hall.`;

export class SellHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.SELL, 'Sale failed');
  }

  protected async perform({ teamId, userId, text, say }: HandlerContext) {
    if (!this.player?.isInHq) {
      await say({ text: 'Teleport to the guild before selling items.' });
      return;
    }
    const [, ...tokens] = text.trim().split(/\s+/);
    if (tokens.length === 0) {
      await say({ text: usage });
      return;
    }
    const item = tokens.join(' ');
    const response = await this.dm.guildSellItem({ teamId, userId, item });

    if (!response?.receiptId) {
      await say({ text: 'Sale failed. Check the item name or inventory.' });
      return;
    }

    await say({
      text: `💰 Sold ${item} for ${response.goldDelta ?? 0} gold. Remaining gold: ${response.remainingGold}.`,
    });
  }
}

export const sellHandler = new SellHandler();
