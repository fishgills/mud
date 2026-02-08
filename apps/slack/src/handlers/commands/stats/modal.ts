import type { ModalView, KnownBlock } from '@slack/types';
import { STAT_ACTIONS } from '../../../commands';
import { PlayerAttribute } from '../../../dm-types';
import type { EquipmentTotals } from '../../../dm-client';
import { displayValue, effectiveStat } from './utils';

export const CHARACTER_SHEET_VIEW_ID = 'character_sheet_view';
export const SKILL_POINT_BLOCK_ID = 'character_sheet_skill_points';
const SKILL_POINT_ACTION_ID = 'character_sheet_attribute';

type CharacterSheetSource = {
  name?: string | null;
  level?: number | null;
  xp?: number | null;
  xpToNextLevel?: number | null;
  gold?: number | null;
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

const formatNumber = (value: number, decimals = 1): string => {
  if (Number.isNaN(value)) return '—';
  if (decimals === 0) return String(Math.round(value));
  return Number.isInteger(value) ? String(value) : value.toFixed(decimals);
};

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const resolveStatBonuses = (equipmentTotals?: EquipmentTotals | null) => {
  return {
    strength: equipmentTotals?.strengthBonus ?? 0,
    agility: equipmentTotals?.agilityBonus ?? 0,
    health: equipmentTotals?.healthBonus ?? 0,
  };
};

const formatStatWithGear = (
  value: number | null | undefined,
  gearBonus: number,
): string => {
  if (value == null) return '—';
  const total = value + gearBonus;
  const effective = effectiveStat(total);
  if (effective == null) return '—';
  const baseText =
    gearBonus === 0
      ? ''
      : `, base ${value}, ${gearBonus >= 0 ? '+' : ''}${gearBonus} gear`;
  return `${total} (eff ${formatNumber(effective)}${baseText})`;
};

const formatXpLine = (player: CharacterSheetSource): string => {
  if (typeof player.xp !== 'number') return '—';
  if (typeof player.xpToNextLevel !== 'number') return displayValue(player.xp);
  return `${player.xp} ( Next level: ${player.xpToNextLevel})`;
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

const parseDice = (dice: string): { count: number; sides: number } => {
  const parts = dice.toLowerCase().split('d');
  if (parts.length !== 2) return { count: 1, sides: 4 };
  const count = parseInt(parts[0], 10);
  const sides = parseInt(parts[1], 10);
  if (Number.isNaN(count) || Number.isNaN(sides)) return { count: 1, sides: 4 };
  return { count, sides };
};

const estimateWeaponDamage = (damageRoll: string): number => {
  const { count, sides } = parseDice(damageRoll);
  return (count * (sides + 1)) / 2;
};

type CombatSnapshot = {
  attackRating: number;
  defenseRating: number;
  baseDamage: number;
  mitigation: number;
  initiative: number;
  weaponDamageRoll: string;
};

const computeCombatSnapshot = (
  player: CharacterSheetSource,
): CombatSnapshot => {
  const bonuses = resolveStatBonuses(player.equipmentTotals);
  const strength = (player.strength ?? 0) + bonuses.strength;
  const agility = (player.agility ?? 0) + bonuses.agility;
  const health = (player.health ?? 0) + bonuses.health;
  const level = player.level ?? 1;

  const effectiveStrength = effectiveStat(strength) ?? 0;
  const effectiveAgility = effectiveStat(agility) ?? 0;
  const effectiveHealth = effectiveStat(health) ?? 0;
  const effectiveLevel = effectiveStat(level) ?? 0;

  const attackRating =
    10 * effectiveStrength + 4 * effectiveAgility + 6 * effectiveLevel;
  const defenseRating =
    10 * effectiveAgility + 2 * effectiveHealth + 6 * effectiveLevel;
  const coreDamage = 4 + 2 * effectiveStrength + 0.5 * effectiveLevel;
  const weaponDamageRoll = resolveDamageRoll(player);
  const baseDamage = coreDamage + estimateWeaponDamage(weaponDamageRoll);
  const toughness = 6 * effectiveHealth + 3 * effectiveAgility;
  const mitigation = toughness / (toughness + 100);
  const initiative = 1000 * effectiveAgility + 10 * effectiveLevel;

  return {
    attackRating,
    defenseRating,
    baseDamage,
    mitigation,
    initiative,
    weaponDamageRoll,
  };
};

export const buildCharacterSheetBlocks = (
  player: CharacterSheetSource,
  options: { isSelf: boolean; includeSpendInput?: boolean },
): KnownBlock[] => {
  const skillPoints = Math.max(0, player.skillPoints ?? 0);
  const showSpendInput =
    options.isSelf && skillPoints > 0 && options.includeSpendInput !== false;
  const showSpendButton =
    options.isSelf && skillPoints > 0 && options.includeSpendInput === false;
  const bonuses = resolveStatBonuses(player.equipmentTotals);
  const combat = computeCombatSnapshot(player);
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Name* ${displayValue(player.name)}` },
        { type: 'mrkdwn', text: `*🏅 Level* ${displayValue(player.level)}` },
        { type: 'mrkdwn', text: `*📈 XP* ${formatXpLine(player)}` },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*💪 Strength* ${formatStatWithGear(
            player.strength,
            bonuses.strength,
          )}`,
        },
        {
          type: 'mrkdwn',
          text: `*🌀 Agility* ${formatStatWithGear(
            player.agility,
            bonuses.agility,
          )}`,
        },
        {
          type: 'mrkdwn',
          text: `*❤️ Vitality* ${formatStatWithGear(
            player.health,
            bonuses.health,
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
          text: `*❤️ HP* ${formatHpLine(player)}`,
        },
        {
          type: 'mrkdwn',
          text: `*⚔️ Attack Rating* ${formatNumber(combat.attackRating)}`,
        },
        {
          type: 'mrkdwn',
          text: `*🛡️ Defense Rating* ${formatNumber(combat.defenseRating)}`,
        },
        {
          type: 'mrkdwn',
          text: `*🎯 Avg Base Damage* ${formatNumber(combat.baseDamage)} (weapon ${combat.weaponDamageRoll})`,
        },
        {
          type: 'mrkdwn',
          text: `*🧱 Mitigation* ${formatPercent(combat.mitigation)}`,
        },
        {
          type: 'mrkdwn',
          text: `*⚡ Initiative* ${formatNumber(combat.initiative, 0)}`,
        },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `✨ *Skill points available* ${skillPoints}`,
        },
        {
          type: 'mrkdwn',
          text: `*💰 Gold* ${displayValue(player.gold)}`,
        },
      ],
    },
  ];

  if (showSpendButton) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Spend Skill Point' },
            style: 'primary',
            action_id: STAT_ACTIONS.OPEN_LEVEL_UP,
          },
        ],
      },
    );
  }

  if (showSpendInput) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        block_id: SKILL_POINT_BLOCK_ID,
        text: {
          type: 'mrkdwn',
          text: '*Spend a skill point*',
        },
        accessory: {
          action_id: SKILL_POINT_ACTION_ID,
          type: 'static_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select a stat',
          },
          options: attributeOptions.map((attribute) => ({
            text: {
              type: 'plain_text',
              text: attribute.label,
            },
            value: attribute.value,
          })),
        },
      },
    );
  }

  return blocks;
};

export const parseSkillPointAttribute = (
  values: Record<
    string,
    Record<string, { selected_option?: { value?: string } | null }>
  >,
): PlayerAttribute | null => {
  const selection =
    values?.[SKILL_POINT_BLOCK_ID]?.[SKILL_POINT_ACTION_ID]?.selected_option
      ?.value;
  if (
    selection === PlayerAttribute.Strength ||
    selection === PlayerAttribute.Agility ||
    selection === PlayerAttribute.Health
  ) {
    return selection;
  }
  return null;
};

export const buildCharacterSheetModal = (
  player: CharacterSheetSource,
  options: {
    teamId: string;
    userId: string;
    isSelf: boolean;
    includeSpendInput?: boolean;
  },
) => {
  const includeSpendInput =
    options.includeSpendInput ?? Boolean(options.isSelf);
  const privateMetadata = JSON.stringify({
    teamId: options.teamId,
    userId: options.userId,
  });

  return {
    type: 'modal',
    callback_id: CHARACTER_SHEET_VIEW_ID,
    private_metadata: privateMetadata,
    title: { type: 'plain_text', text: 'Character Sheet' },
    submit: includeSpendInput
      ? { type: 'plain_text', text: 'Spend Skill Point' }
      : undefined,
    close: includeSpendInput
      ? { type: 'plain_text', text: 'Cancel' }
      : undefined,
    blocks: buildCharacterSheetBlocks(player, {
      isSelf: options.isSelf,
      includeSpendInput,
    }),
  } as ModalView;
};
