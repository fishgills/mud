import type { ModalView, KnownBlock } from '@slack/types';
import { PlayerAttribute } from '../../dm-types';
import type { EquipmentTotals } from '../../dm-client';

export const CHARACTER_SHEET_VIEW_ID = 'character_sheet_view';
export const SKILL_POINT_BLOCK_ID = 'character_sheet_skill_points';
const SKILL_POINT_ACTION_ID = 'character_sheet_attribute';

type CharacterSheetSource = {
  name?: string | null;
  level?: number | null;
  xp?: number | null;
  xpToNextLevel?: number | null;
  hp?: number | null;
  maxHp?: number | null;
  strength?: number | null;
  agility?: number | null;
  health?: number | null;
  damageRoll?: string | null;
  skillPoints?: number | null;
  equipmentTotals?: EquipmentTotals | null;
};

const attributeOptions = [
  { label: 'Strength', value: PlayerAttribute.Strength },
  { label: 'Agility', value: PlayerAttribute.Agility },
  { label: 'Vitality', value: PlayerAttribute.Health },
];

const displayValue = (value: unknown) =>
  value === undefined || value === null ? '—' : String(value);

const getAbilityModifier = (value: number | null | undefined): number | null => {
  if (value == null) return null;
  return Math.floor((value - 10) / 2);
};

const formatSigned = (value: number | null | undefined): string => {
  if (value == null) return '—';
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : `${value}`;
};

const formatXpLine = (player: CharacterSheetSource): string => {
  if (typeof player.xp !== 'number') return '—';
  if (typeof player.xpToNextLevel !== 'number') return displayValue(player.xp);
  return `${player.xp} / ${player.xpToNextLevel}`;
};

const formatHpLine = (player: CharacterSheetSource): string => {
  if (typeof player.hp !== 'number' || typeof player.maxHp !== 'number') {
    return '—';
  }
  return `${player.hp} / ${player.maxHp}`;
};

const resolveDamageRoll = (player: CharacterSheetSource): string => {
  const roll =
    player.equipmentTotals?.weaponDamageRoll ??
    (typeof player.damageRoll === 'string' ? player.damageRoll : null) ??
    '1d4';
  return roll;
};

const formatDamageLine = (player: CharacterSheetSource): string => {
  const base = getAbilityModifier(player.strength);
  if (base == null) return '—';
  const bonus = base + (player.equipmentTotals?.damageBonus ?? 0);
  const sign = bonus === 0 ? '' : bonus > 0 ? ` + ${bonus}` : ` - ${Math.abs(bonus)}`;
  return `${resolveDamageRoll(player)}${sign}`;
};

const formatArmorClass = (player: CharacterSheetSource): string => {
  const agilityMod = getAbilityModifier(player.agility);
  if (agilityMod == null) return '—';
  const armorBonus = player.equipmentTotals?.armorBonus ?? 0;
  return String(10 + agilityMod + armorBonus);
};

const formatAttackBonus = (player: CharacterSheetSource): string => {
  const base = getAbilityModifier(player.strength);
  if (base == null) return '—';
  const total = base + (player.equipmentTotals?.attackBonus ?? 0);
  return formatSigned(total);
};

const formatAttribute = (
  value: number | null | undefined,
  gearBonus = 0,
): string => {
  const modifier = getAbilityModifier(value);
  if (value == null || modifier == null) return '—';
  const total = value + gearBonus;
  const sign = modifier >= 0 ? '+' : '';
  return `${total} (${sign}${modifier})`;
};

export const buildCharacterSheetModal = (
  player: CharacterSheetSource,
  options: { teamId: string; userId: string; isSelf: boolean },
): ModalView => {
  const skillPoints = Math.max(0, player.skillPoints ?? 0);
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Name*\n${displayValue(player.name)}` },
        { type: 'mrkdwn', text: `*Level*\n${displayValue(player.level)}` },
        { type: 'mrkdwn', text: `*XP*\n${formatXpLine(player)}` },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Strength*\n${formatAttribute(player.strength)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Agility*\n${formatAttribute(player.agility)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Vitality*\n${formatAttribute(
            player.health,
            player.equipmentTotals?.vitalityBonus ?? 0,
          )}`,
        },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*❤️ HP*\n${formatHpLine(player)}`,
        },
        {
          type: 'mrkdwn',
          text: `*🛡️ Armor Class*\n${formatArmorClass(player)}`,
        },
        {
          type: 'mrkdwn',
          text: `*⚔️ Attack Bonus*\n${formatAttackBonus(player)}`,
        },
        {
          type: 'mrkdwn',
          text: `*🎯 Damage*\n${formatDamageLine(player)}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `✨ Skill points available: ${skillPoints}`,
        },
      ],
    },
  ];

  if (options.isSelf && skillPoints > 0) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Spend a skill point*\nYou have ${skillPoints} to invest.`,
        },
      },
      {
        type: 'input',
        block_id: SKILL_POINT_BLOCK_ID,
        label: { type: 'plain_text', text: 'Choose an attribute' },
        element: {
          type: 'static_select',
          action_id: SKILL_POINT_ACTION_ID,
          placeholder: {
            type: 'plain_text',
            text: 'Select Strength, Agility, or Vitality',
          },
          options: attributeOptions.map((option) => ({
            text: { type: 'plain_text', text: option.label },
            value: option.value,
          })),
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Each point permanently increases the chosen attribute.',
          },
        ],
      },
    );
  }

  return {
    type: 'modal',
    callback_id: CHARACTER_SHEET_VIEW_ID,
    title: { type: 'plain_text', text: '🧙 Character Sheet', emoji: true },
    close: { type: 'plain_text', text: 'Close', emoji: true },
    submit:
      options.isSelf && skillPoints > 0
        ? { type: 'plain_text', text: 'Spend Point', emoji: true }
        : undefined,
    private_metadata: JSON.stringify({
      teamId: options.teamId,
      userId: options.userId,
    }),
    blocks,
  };
};

export const parseSkillPointAttribute = (
  values:
    | Record<
        string,
        Record<string, { selected_option?: { value?: string } | null }>
      >
    | undefined,
): string | null => {
  const selected =
    values?.[SKILL_POINT_BLOCK_ID]?.[SKILL_POINT_ACTION_ID]?.selected_option
      ?.value;
  return selected ?? null;
};
