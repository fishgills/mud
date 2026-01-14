import type { KnownBlock } from '@slack/types';
import { COMMANDS, GUILD_SHOP_ACTIONS } from '../commands';
import { PlayerCommandHandler } from './base';
import type { HandlerContext } from './types';
import type { GuildCatalogItem } from '../dm-client';
import { getQualityBadge, formatQualityLabel } from '@mud/constants';

const buildCatalogBlocks = (items: GuildCatalogItem[]): KnownBlock[] => {
  if (items.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'The guild merchants are restocking. Check back in a few minutes.',
        },
      },
    ];
  }

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🛒 Guild Store',
        emoji: true,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Use the buttons below or type \`${COMMANDS.CATALOG}\` again to refresh. Sell items via \`${COMMANDS.INVENTORY}\`. Stock rotates every 5 minutes.`,
        },
      ],
    },
  ];

  items.forEach((item) => {
    const bonusLines: string[] = [];
    if (item.damageRoll) {
      bonusLines.push(`*Damage*: ${item.damageRoll}`);
    }
    if (typeof item.defense === 'number' && item.defense !== 0) {
      bonusLines.push(`*Defense*: ${item.defense}`);
    }
    const qualityBadge = getQualityBadge(item.quality);
    const qualityLabel = formatQualityLabel(item.quality);

    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Item*\n${item.name}`,
        },
        {
          type: 'mrkdwn',
          text: `*Quality*\n${qualityBadge} ${qualityLabel}`,
        },
        {
          type: 'mrkdwn',
          text: `*Price*\n${item.buyPriceGold} gold`,
        },
        {
          type: 'mrkdwn',
          text: `*Stock*\n${item.stockQuantity}`,
        },
        {
          type: 'mrkdwn',
          text: bonusLines.length
            ? `*Bonuses*\n${bonusLines.map((line) => `• ${line}`).join('\n')}`
            : '*Bonuses*\n—',
        },
        {
          type: 'mrkdwn',
          text: item.tags?.length
            ? `*Tags*\n${item.tags.map((t) => `\`${t}\``).join(', ')}`
            : '*Tags*\n—',
        },
      ],
    });

    if (item.description) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: item.description,
        },
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: `Buy ${item.name}`, emoji: true },
          action_id: GUILD_SHOP_ACTIONS.BUY,
          value: item.sku,
        },
      ],
    });
    blocks.push({ type: 'divider' });
  });

  return blocks;
};

class CatalogHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.CATALOG, 'Unable to list guild store');
  }

  protected async perform({ say }: HandlerContext): Promise<void> {
    const items = await this.dm.guildListCatalog();
    const blocks = buildCatalogBlocks(items);
    await say({
      text: 'Guild store',
      blocks,
    });
  }
}

export const catalogHandler = new CatalogHandler();
