import type { KnownBlock } from '@slack/types';
import { COMMANDS, GUILD_SHOP_ACTIONS } from '../../commands';
import { PlayerCommandHandler } from '../base';
import type { HandlerContext } from '../types';
import type { GuildCatalogItem } from '../../dm-client';
import { getQualityBadge, formatQualityLabel } from '@mud/constants';
import { formatSignedStat } from '../../utils/itemDisplay';

const formatSlotLabel = (slot?: string | null) => {
  if (!slot) return '—';
  return slot[0].toUpperCase() + slot.slice(1);
};

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
          text: `Use the buttons below or type \`${COMMANDS.CATALOG}\` again to refresh. Sell items via \`${COMMANDS.INVENTORY}\`. Stock rotates on tick events.`,
        },
      ],
    },
  ];

  items.forEach((item) => {
    const bonusLines: string[] = [];
    if (item.damageRoll) {
      bonusLines.push(`*Damage*: ${item.damageRoll}`);
    }
    if (typeof item.strengthBonus === 'number' && item.strengthBonus !== 0) {
      bonusLines.push(`*Strength*: ${formatSignedStat(item.strengthBonus)}`);
    }
    if (typeof item.agilityBonus === 'number' && item.agilityBonus !== 0) {
      bonusLines.push(`*Agility*: ${formatSignedStat(item.agilityBonus)}`);
    }
    if (typeof item.healthBonus === 'number' && item.healthBonus !== 0) {
      bonusLines.push(`*Health*: ${formatSignedStat(item.healthBonus)}`);
    }
    const qualityBadge = getQualityBadge(item.quality);
    const qualityLabel = formatQualityLabel(item.quality);
    const fields: Array<{ type: 'mrkdwn'; text: string }> = [
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
        text: `*Slot*\n${formatSlotLabel(item.slot)}`,
      },
      {
        type: 'mrkdwn',
        text: `*Price*\n${item.buyPriceGold} gold`,
      },
      {
        type: 'mrkdwn',
        text: `*Stock*\n${item.stockQuantity}`,
      },
    ];

    if (item.ticketRequirement) {
      fields.push({
        type: 'mrkdwn',
        text: `*Ticket*\n${item.ticketRequirement} Ticket`,
      });
    }

    fields.push({
      type: 'mrkdwn',
      text: bonusLines.length
        ? `*Bonuses*\n${bonusLines.map((line) => `• ${line}`).join('\n')}`
        : '*Bonuses*\n—',
    });

    blocks.push({
      type: 'section',
      fields,
    });

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
