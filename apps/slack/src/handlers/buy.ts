import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';
import type { HandlerContext } from './types';

export class BuyHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.BUY, 'Purchase failed');
  }

  protected async perform({ teamId, userId, text, say }: HandlerContext) {
    if (!this.player?.isInHq) {
      await say({
        text: `Use \`${COMMANDS.GUILD}\` to teleport to the guild before buying items.`,
      });
      return;
    }
    const tokens = text.trim().split(/\s+/);
    const sku = tokens.slice(1).join(' ');
    if (!sku) {
      await say({
        text: `Use the \`${COMMANDS.CATALOG}\` buttons in the guild hall to purchase items.`,
      });
      return;
    }
    const response = await this.dm.guildBuyItem({ teamId, userId, sku });

    if (!response?.receiptId) {
      await say({
        text: 'Purchase failed. Confirm the item is still in stock.',
      });
      return;
    }

    const cost = Math.abs(response.goldDelta ?? 0);
    await say({
      text: `🛒 Purchased ${sku} for ${cost} gold. Remaining gold: ${response.remainingGold}.`,
    });
  }
}

export const buyHandler = new BuyHandler();
