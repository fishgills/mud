import { COMMANDS, GUILD_SHOP_ACTIONS } from '../../commands';
import { getPlayerItems, ItemRecord } from '../../dm-client';
import type { PlayerRecord } from '../../dm-client';
import { MISSING_CHARACTER_MESSAGE } from '../characterUtils';
import type { KnownBlock, ActionsBlock, Button, ModalView } from '@slack/types';
// Use Prisma-generated enum for item qualities so the mapping follows the
// canonical backend enum values.
import { PlayerSlot } from '@mud/database';
import { formatSignedStat } from '../../utils/itemDisplay';

type PlayerWithBag = PlayerRecord & { bag?: ItemRecord[] };
import { getUserFriendlyErrorMessage } from '../errorUtils';
import { registerHandler } from '../handlerRegistry';
import type { HandlerContext } from '../types';

type EquipmentSlotKey = PlayerSlot;

const EQUIPMENT_SLOTS: Array<{ key: EquipmentSlotKey; label: string }> = [
  { key: PlayerSlot.head, label: 'Head' },
  { key: PlayerSlot.chest, label: 'Chest' },
  { key: PlayerSlot.legs, label: 'Legs' },
  { key: PlayerSlot.arms, label: 'Arms' },
  { key: PlayerSlot.weapon, label: 'Weapon' },
];

const SLOT_EMOJIS: Record<EquipmentSlotKey, string> = {
  [PlayerSlot.head]: '🪖',
  [PlayerSlot.chest]: '🛡️',
  [PlayerSlot.arms]: '🧤',
  [PlayerSlot.legs]: '👢',
  [PlayerSlot.weapon]: '🗡️',
};

const resolvePlayerItemId = (item: ItemRecord | undefined): number | null => {
  const id = item?.id;
  return typeof id === 'number' ? id : null;
};

const normalizeTicketCount = (value: number | null | undefined): number =>
  Number.isFinite(value) ? Number(value) : 0;

const buildTicketSummaryBlock = (player: PlayerRecord): KnownBlock => {
  const rare = normalizeTicketCount(player.rareTickets);
  const epic = normalizeTicketCount(player.epicTickets);
  const legendary = normalizeTicketCount(player.legendaryTickets);

  return {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `🎟️ Tickets: *${rare}* Rare · *${epic}* Epic · *${legendary}* Legendary`,
      },
    ],
  };
};

const buildItemStatLines = (item: ItemRecord | undefined): string[] => {
  if (!item) return [];
  const stats: string[] = [];
  const bonuses = item.computedBonuses;
  const fallbackRoll =
    typeof item.damageRoll === 'string' && item.damageRoll.trim().length > 0
      ? item.damageRoll
      : (item.item?.damageRoll ?? null);
  const damageRoll = bonuses?.weaponDamageRoll ?? fallbackRoll;
  if (damageRoll) {
    stats.push(`Damage ${damageRoll}`);
  }
  if (bonuses) {
    if (bonuses.strengthBonus) {
      stats.push(`Strength ${formatSignedStat(bonuses.strengthBonus)}`);
    }
    if (bonuses.agilityBonus) {
      stats.push(`Agility ${formatSignedStat(bonuses.agilityBonus)}`);
    }
    if (bonuses.healthBonus) {
      stats.push(`Health ${formatSignedStat(bonuses.healthBonus)}`);
    }
  }

  if (stats.length === 0) {
    const rawDefense =
      typeof item.defense === 'number' && item.defense !== 0
        ? item.defense
        : (item.item?.defense ?? null);
    if (typeof rawDefense === 'number' && rawDefense !== 0) {
      stats.push(`Armor ${formatSignedStat(rawDefense)}`);
    }
  }

  return stats;
};

const resolveSlotEmoji = (slot: EquipmentSlotKey | null | undefined): string =>
  slot ? (SLOT_EMOJIS[slot] ?? '🎒') : '🎒';

const formatItemDisplay = (item: ItemRecord | undefined): string => {
  if (!item) return '- Empty -';
  return item.itemName ?? 'Unknown Item';
};

const formatStatLine = (item: ItemRecord | undefined): string => {
  const statLines = buildItemStatLines(item);
  if (statLines.length === 0) return '_No bonuses_';
  return statLines.join(' · ');
};

const createEquippedItemBlocks = (
  slotLabel: string,
  slotKey: EquipmentSlotKey,
  item: ItemRecord | undefined,
): KnownBlock[] => {
  const playerItemId = resolvePlayerItemId(item);
  const title = formatItemDisplay(item);
  const stats = item ? formatStatLine(item) : null;
  const emoji = resolveSlotEmoji(slotKey);
  const text = stats
    ? `*${emoji} ${slotLabel}*\n${title}\n${stats}`
    : `*${emoji} ${slotLabel}*\n${title}`;

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text,
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
      ],
    } as ActionsBlock);
  }

  return blocks;
};

const createBackpackItemBlocks = (
  item: ItemRecord,
  opts?: { allowSell?: boolean },
): KnownBlock[] => {
  const playerItemId = resolvePlayerItemId(item);
  const name = item.itemName ?? 'Unknown Item';
  const allowedSlots: string[] = Array.isArray(item.allowedSlots)
    ? item.allowedSlots
    : [];
  const equipDisabled = allowedSlots.length === 0;
  const slot =
    (item.slot as EquipmentSlotKey | null | undefined) ??
    (allowedSlots[0] as EquipmentSlotKey | undefined);
  const emoji = resolveSlotEmoji(slot);

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
    if (opts?.allowSell) {
      actions.push({
        type: 'button',
        text: { type: 'plain_text', text: 'Sell' },
        action_id: GUILD_SHOP_ACTIONS.SELL,
        value: String(playerItemId),
      });
    }
  }

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${emoji} ${name}*\n${formatStatLine(item)}`,
      },
    },
  ];

  if (actions.length > 0) {
    blocks.push({
      type: 'actions',
      elements: actions,
    } as ActionsBlock);
  }

  return blocks;
};

const buildInventoryBlocks = (player: PlayerRecord): KnownBlock[] => {
  const equipment = player.equipment ?? {};
  const bag = (player as PlayerWithBag).bag ?? [];
  const bagById = new Map<number, ItemRecord>();
  bag.forEach((item) => {
    if (typeof item.id === 'number') {
      bagById.set(item.id, item);
    }
  });

  const equippedEntries = EQUIPMENT_SLOTS.map(({ key, label }) => {
    const equippedValue = equipment[key];
    let item: ItemRecord | undefined;
    let equippedId: number | null = null;

    if (equippedValue) {
      // New format: { id: number, quality: string }
      if (typeof equippedValue === 'object' && 'id' in equippedValue) {
        equippedId = equippedValue.id;
      } else if (typeof equippedValue === 'number') {
        // Legacy format: just a number
        equippedId = equippedValue;
      }

      if (equippedId) {
        item = bagById.get(equippedId);
      }
    }

    if (!item) {
      item = bag.find((bagItem) => bagItem.slot === key && bagItem.equipped);
    }

    return { key, label, item };
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

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🧍 Equipped Gear*',
      },
    },
  ];

  blocks.unshift(buildTicketSummaryBlock(player));

  for (const entry of equippedEntries) {
    blocks.push(
      ...createEquippedItemBlocks(entry.label, entry.key, entry.item),
    );
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*🎒 Backpack (${unequippedItems.length} items)*`,
    },
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
      blocks.push(...createBackpackItemBlocks(item, { allowSell: true }));
    });
  }

  return blocks;
};

export const buildInventoryModal = (player: PlayerRecord): ModalView => ({
  type: 'modal',
  title: { type: 'plain_text', text: '🎒 Inventory', emoji: true },
  close: { type: 'plain_text', text: 'Close', emoji: true },
  blocks: buildInventoryBlocks(player),
});

export const inventoryHandler = async ({
  userId,
  say,
  teamId,
  client,
  triggerId,
}: HandlerContext): Promise<void> => {
  try {
    const response = await getPlayerItems({
      teamId,
      userId,
    });
    if (!response.success || !response.data) {
      await say({
        text:
          (response.message as string | undefined) ?? MISSING_CHARACTER_MESSAGE,
      });
      return;
    }

    // `getPlayerItems` returns a PlayerResponse where data includes bag
    if (client?.views?.open && triggerId) {
      await client.views.open({
        trigger_id: triggerId,
        view: buildInventoryModal(response.data),
      });
      return;
    }

    await say({
      text: 'Inventory',
      blocks: buildInventoryBlocks(response.data),
    });
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
  buildInventoryBlocks,
  resolveSlotEmoji,
  formatItemDisplay,
  formatStatLine,
  buildInventoryModal,
};
