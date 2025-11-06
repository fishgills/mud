import { COMMANDS } from '../commands';
import { getPlayerItems, ItemRecord } from '../dm-client';
import type { PlayerRecord } from '../dm-client';
import type { KnownBlock, Block, ActionsBlock, Button } from '@slack/types';
// Use Prisma-generated enum for item qualities so the mapping follows the
// canonical backend enum values.
import { ItemQuality, PlayerSlot } from '@prisma/client';
import { getQualityBadge, formatQualityLabel } from '@mud/constants';

type PlayerWithBag = PlayerRecord & { bag?: ItemRecord[] };
import { getUserFriendlyErrorMessage } from './errorUtils';
import { registerHandler } from './handlerRegistry';
import type { HandlerContext, SayMessage } from './types';
import { toClientId } from '../utils/clientId';

type EquipmentSlotKey = PlayerSlot;

const EQUIPMENT_SLOTS: Array<{ key: EquipmentSlotKey; label: string }> = [
  { key: PlayerSlot.head, label: 'Head' },
  { key: PlayerSlot.chest, label: 'Chest' },
  { key: PlayerSlot.legs, label: 'Legs' },
  { key: PlayerSlot.arms, label: 'Arms' },
  { key: PlayerSlot.weapon, label: 'Weapon' },
];

const defaultQuality = String(ItemQuality.Common);

const resolvePlayerItemId = (item: ItemRecord | undefined): number | null => {
  const id = item?.id;
  return typeof id === 'number' ? id : null;
};

const formatItemDisplay = (item: ItemRecord | undefined): string => {
  if (!item) return '_Empty_';
  const badge = getQualityBadge(item.quality ?? defaultQuality);
  const qualityLabel = formatQualityLabel(item.quality ?? defaultQuality);
  const name = item.itemName ?? 'Unknown Item';
  return `${badge} ${qualityLabel} ${name}`;
};

const createEquippedItemBlocks = (
  slotLabel: string,
  item: ItemRecord,
): Array<KnownBlock | Block> => {
  const playerItemId = resolvePlayerItemId(item);
  const title = formatItemDisplay(item);

  const blocks: Array<KnownBlock | Block> = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${slotLabel}*
${title}`,
      },
    },
  ];

  if (playerItemId !== null) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Unequip' },
          style: 'primary',
          action_id: 'inventory_unequip',
          value: String(playerItemId),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Drop' },
          style: 'danger',
          action_id: 'inventory_drop',
          value: String(playerItemId),
        },
      ],
    } as ActionsBlock);
  }

  return blocks;
};

const createBackpackItemBlocks = (
  item: ItemRecord,
): Array<KnownBlock | Block> => {
  const playerItemId = resolvePlayerItemId(item);
  const badge = getQualityBadge(item.quality ?? defaultQuality);
  const qualityLabel = formatQualityLabel(item.quality ?? defaultQuality);
  const name = item.itemName ?? 'Unknown Item';
  const allowedSlots: string[] = Array.isArray(item.allowedSlots)
    ? item.allowedSlots
    : [];
  const equipDisabled = allowedSlots.length === 0;

  const actions: Button[] = [];

  if (!equipDisabled && playerItemId !== null) {
    actions.push({
      type: 'button',
      text: { type: 'plain_text', text: 'Equip' },
      action_id: 'inventory_equip',
      value: JSON.stringify({
        playerItemId,
        allowedSlots,
      }),
    });
  }

  if (playerItemId !== null) {
    actions.push({
      type: 'button',
      text: { type: 'plain_text', text: 'Drop' },
      style: 'danger',
      action_id: 'inventory_drop',
      value: String(playerItemId),
    });
  }

  const blocks: Array<KnownBlock | Block> = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${badge} ${qualityLabel} ${name}*`,
      },
    },
  ];

  if (actions.length > 0) {
    blocks.push({
      type: 'actions',
      elements: actions,
    } as ActionsBlock);
  }

  if (equipDisabled) {
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
};

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
      return found.itemName ?? 'Unknown Item';
    }
  }

  if (typeof value === 'number') {
    return `Item #${value}`;
  }

  return 'Unknown Item';
};

const buildInventoryMessage = (player: PlayerRecord): SayMessage => {
  const equipment = player.equipment ?? {};
  const bag = (player as PlayerWithBag).bag ?? [];
  const bagById = new Map<number, ItemRecord>();
  bag.forEach((item) => {
    if (typeof item.id === 'number') {
      bagById.set(item.id, item);
    }
  });

  const equippedEntries = EQUIPMENT_SLOTS.map(({ key, label }) => {
    const equippedId = equipment[key];
    let item: ItemRecord | undefined;

    if (typeof equippedId === 'number') {
      item = bagById.get(equippedId);
    }

    if (!item) {
      item = bag.find((bagItem) => bagItem.slot === key && bagItem.equipped);
    }

    return { key, label, item, fallback: formatSlotValue(equippedId, bag) };
  });

  const equippedIds = new Set<number>();
  for (const entry of equippedEntries) {
    const id = resolvePlayerItemId(entry.item);
    if (id !== null) {
      equippedIds.add(id);
    }
  }

  const unequippedItems = bag.filter((item) => {
    const id = resolvePlayerItemId(item);
    if (id !== null && equippedIds.has(id)) {
      return false;
    }
    return !(item.equipped === true);
  });

  const level = player.level ?? '?';
  const gold = player.gold ?? 0;
  const hp = player.hp ?? 0;
  const maxHp = player.maxHp ?? hp;

  const blocks: Array<KnownBlock | Block> = [
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
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Equipped Gear*',
      },
    },
  ];

  for (const entry of equippedEntries) {
    if (entry.item) {
      blocks.push(...createEquippedItemBlocks(entry.label, entry.item));
      continue;
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${entry.label}*\n${entry.fallback}`,
      },
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: '*Backpack*' },
  });

  if (unequippedItems.length === 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '_Your backpack is empty._',
        },
      ],
    });
  } else {
    unequippedItems.forEach((item) => {
      blocks.push(...createBackpackItemBlocks(item));
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Use \`${COMMANDS.STATS}\` for detailed attributes.`,
      },
    ],
  });

  return {
    text: `${player.name ?? 'Inventory'}`,
    blocks,
  };
};

export const inventoryHandler = async ({
  userId,
  say,
  teamId,
}: HandlerContext): Promise<void> => {
  const missingCharacterMessage = `You don't have a character yet! Use "${COMMANDS.NEW} YourName" to create one.`;
  try {
    const response = await getPlayerItems({
      slackId: toClientId(userId, teamId || ''),
    });
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
