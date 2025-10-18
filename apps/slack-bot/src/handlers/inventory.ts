import { COMMANDS } from '../commands';
import { getPlayer } from '../dm-client';
import type { PlayerRecord } from '../dm-client';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { registerHandler } from './handlerRegistry';
import type { HandlerContext, SayMessage } from './types';
import { toClientId } from '../utils/clientId';

type EquipmentSlotKey =
  | 'head'
  | 'chest'
  | 'legs'
  | 'arms'
  | 'leftHand'
  | 'rightHand';

const EQUIPMENT_SLOTS: Array<{ key: EquipmentSlotKey; label: string }> = [
  { key: 'head', label: 'Head' },
  { key: 'chest', label: 'Chest' },
  { key: 'legs', label: 'Legs' },
  { key: 'arms', label: 'Arms' },
  { key: 'leftHand', label: 'Left Hand' },
  { key: 'rightHand', label: 'Right Hand' },
];

const formatSlotValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return '_Empty_';
  }
  return `Item #${value}`;
};

const buildInventoryMessage = (player: PlayerRecord): SayMessage => {
  const equipment = player.equipment ?? {};
  const equipmentLines = EQUIPMENT_SLOTS.map(
    ({ key, label }) => `• *${label}:* ${formatSlotValue(equipment[key])}`,
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
    const response = await getPlayer({ slackId: toClientId(userId) });
    if (!response.success || !response.data) {
      await say({
        text:
          (response.message as string | undefined) ?? missingCharacterMessage,
      });
      return;
    }

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
