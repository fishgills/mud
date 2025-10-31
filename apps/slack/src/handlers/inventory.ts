import { COMMANDS } from '../commands';
import { getPlayerItems, ItemRecord } from '../dm-client';
import type { PlayerRecord } from '../dm-client';
import type { KnownBlock, Block, ActionsBlock, Button } from '@slack/types';
// Use Prisma-generated enum for item qualities so the mapping follows the
// canonical backend enum values.
import { ItemQuality } from '@prisma/client';
import { getQualityBadge, formatQualityLabel } from '@mud/constants';

type PlayerWithBag = PlayerRecord & { bag?: ItemRecord[] };
import { getUserFriendlyErrorMessage } from './errorUtils';
import { registerHandler } from './handlerRegistry';
import type { HandlerContext, SayMessage } from './types';
import { toClientId } from '../utils/clientId';

type EquipmentSlotKey = 'head' | 'chest' | 'legs' | 'arms' | 'weapon';

const EQUIPMENT_SLOTS: Array<{ key: EquipmentSlotKey; label: string }> = [
  { key: 'head', label: 'Head' },
  { key: 'chest', label: 'Chest' },
  { key: 'legs', label: 'Legs' },
  { key: 'arms', label: 'Arms' },
  { key: 'weapon', label: 'Weapon' },
];

const formatSlotValue = (
  value: number | null | undefined,
  bag?: ItemRecord[] | undefined,
): string => {
  if (value === null || value === undefined) {
    return '_Empty_';
  }

  if (Array.isArray(bag)) {
    const found = bag.find((b) => b.id === value || b.itemId === value);
    if (found) {
      // Show human-friendly name; do NOT display numeric ids in the UI
      return found.itemName ?? 'Unknown Item';
    }
  }

  // If a numeric id was provided but we couldn't resolve a name from bag,
  // fall back to the legacy "Item #<id>" label so unit tests and callers
  // that only have an id still get a sensible string. When rendering the
  // actual inventory UI we pass the player's bag so names are shown.
  if (typeof value === 'number') {
    return `Item #${value}`;
  }

  // Otherwise show a neutral unknown label
  return 'Unknown Item';
};

const buildInventoryMessage = (player: PlayerRecord): SayMessage => {
  const equipment = player.equipment ?? {};
  const bag = (player as PlayerWithBag).bag ?? [];

  const equipmentLines = EQUIPMENT_SLOTS.map(
    ({ key, label }) => `• *${label}:* ${formatSlotValue(equipment[key], bag)}`,
  ).join('\n');

  const level = player.level ?? '?';
  const gold = player.gold ?? 0;
  const hp = player.hp ?? 0;
  const maxHp = player.maxHp ?? hp;

  return {
    text: `${player.name ?? 'Inventory'}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🎒 ${player.name ?? 'Inventory'}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Level*\n${level}`,
          },
          {
            type: 'mrkdwn',
            text: `*HP*\n${hp}/${maxHp}`,
          },
          {
            type: 'mrkdwn',
            text: `*Gold*\n${gold}`,
          },
          {
            type: 'mrkdwn',
            text: `*Position*\n(${player.x ?? '?'}, ${player.y ?? '?'})`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            equipmentLines ||
            'You are not wearing any gear yet. Find loot to equip items!',
        },
      },
      // Show bag contents if present — render each item with Equip/Drop buttons
      ...(bag.length > 0
        ? bag.flatMap((it: ItemRecord) => {
            // Pass allowedSlots in the button value as JSON so the action handler
            // can open a modal limited to valid slots for this item.
            const allowedSlots: string[] = Array.isArray(it.allowedSlots)
              ? it.allowedSlots
              : [];
            const equipPayload = JSON.stringify({
              playerItemId: it.id,
              allowedSlots,
            });

            const equipDisabled = allowedSlots.length === 0;

            // Build actions array but omit the Equip button when it's not applicable.
            const actions: Button[] = [];
            if (!equipDisabled) {
              actions.push({
                type: 'button',
                text: { type: 'plain_text', text: 'Equip' },
                action_id: 'inventory_equip',
                value: equipPayload,
              });
            }
            actions.push({
              type: 'button',
              text: { type: 'plain_text', text: 'Drop' },
              style: 'danger',
              action_id: 'inventory_drop',
              value: String(it.id),
            });

            const badge = getQualityBadge(
              it.quality ?? String(ItemQuality.Common),
            );
            const qualityLabel = formatQualityLabel(
              it.quality ?? String(ItemQuality.Common),
            );

            const blocks: Array<KnownBlock | Block> = [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  // Render a small badge, the quality, then the item name. Do not render any numeric ids.
                  text: `*${badge} ${qualityLabel} ${it.itemName ?? 'Unknown Item'}*`,
                },
              },
              {
                type: 'actions',
                elements: actions,
              } as ActionsBlock,
            ];

            if (equipDisabled) {
              // Add a small context note explaining why Equip is disabled
              blocks.push({
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: '_This item cannot be equipped._',
                  },
                ],
              });
            }

            return blocks;
          })
        : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Use \`${COMMANDS.STATS}\` for detailed attributes.`,
          },
        ],
      },
    ],
  };
};

export const inventoryHandler = async ({
  userId,
  say,
}: HandlerContext): Promise<void> => {
  const missingCharacterMessage = `You don't have a character yet! Use "${COMMANDS.NEW} YourName" to create one.`;
  try {
    const response = await getPlayerItems({ slackId: toClientId(userId) });
    if (!response.success || !response.data) {
      await say({
        text:
          (response.message as string | undefined) ?? missingCharacterMessage,
      });
      return;
    }

    // `getPlayerItems` returns a PlayerResponse where data includes bag
    await say(buildInventoryMessage(response.data));
  } catch (error) {
    const message = getUserFriendlyErrorMessage(
      error,
      'Failed to load inventory',
    );
    await say({ text: message });
  }
};

registerHandler(COMMANDS.INVENTORY, inventoryHandler);

export const __private__ = {
  buildInventoryMessage,
  formatSlotValue,
};
