import type { KnownBlock, Block } from '@slack/types';
import { SayMessage } from '../types';
import { MonsterStatsSource, PlayerStatsSource } from './types';
import { STAT_ACTIONS } from '../../commands';

type PlayerStatsFormatOptions = {
  isSelf?: boolean;
};

const displayValue = (value: unknown) =>
  value === undefined || value === null ? '—' : String(value);

const getAbilityModifier = (
  value: number | null | undefined,
): number | null => {
  if (value == null) {
    return null;
  }
  return Math.floor((value - 10) / 2);
};

const attributeWithModifier = (value: number | null | undefined): string => {
  const modifier = getAbilityModifier(value);
  if (value == null || modifier == null) {
    return '—';
  }
  const sign = modifier >= 0 ? '+' : '';
  return `${value} (${sign}${modifier})`;
};

const attributeWithGearBonus = (
  value: number | null | undefined,
  gearBonus: number,
): string => {
  if (value == null) return '—';
  const effectiveValue = value + gearBonus;
  const modifier = Math.floor((effectiveValue - 10) / 2);
  const sign = modifier >= 0 ? '+' : '';
  let text = `${effectiveValue} (${sign}${modifier})`;
  if (gearBonus !== 0) {
    const bonusSign = gearBonus >= 0 ? '+' : '';
    text += ` (base ${value}, ${bonusSign}${gearBonus} gear)`;
  }
  return text;
};

const formatSignedValue = (value: number): string => {
  if (value === 0) {
    return '0';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}`;
};

const formatAttackOrDamageStat = (
  base: number | null,
  gearBonus: number,
): string => {
  if (base == null) {
    return '—';
  }
  const total = base + gearBonus;
  const totalText = formatSignedValue(total);
  const baseText = formatSignedValue(base);
  if (gearBonus === 0) {
    return `${totalText} (base ${baseText})`;
  }
  const gearText = `${gearBonus > 0 ? '+' : ''}${gearBonus} gear`;
  return `${totalText} (base ${baseText}, ${gearText})`;
};

const formatArmorStat = (
  agility: number | null | undefined,
  armorBonus: number,
): string => {
  const modifier = getAbilityModifier(agility);
  if (modifier == null) {
    return '—';
  }
  const baseArmor = 10 + modifier;
  const totalArmor = baseArmor + armorBonus;
  const baseText = `${baseArmor}`;
  if (armorBonus === 0) {
    return `${totalArmor} (base ${baseText})`;
  }
  const gearText = `${armorBonus > 0 ? '+' : ''}${armorBonus} gear`;
  return `${totalArmor} (base ${baseText}, ${gearText})`;
};

const buildActionsBlock = (skillPoints: number): (KnownBlock | Block)[] => {
  if (skillPoints <= 0) {
    return [];
  }

  return [
    {
      type: 'actions',
      block_id: 'skill_point_spend',
      elements: [
        {
          type: 'button',
          action_id: STAT_ACTIONS.INCREASE_STRENGTH,
          text: { type: 'plain_text', text: 'Increase Strength', emoji: true },
          style: 'primary',
          value: 'strength',
        },
        {
          type: 'button',
          action_id: STAT_ACTIONS.INCREASE_AGILITY,
          text: { type: 'plain_text', text: 'Increase Agility', emoji: true },
          style: 'primary',
          value: 'agility',
        },
        {
          type: 'button',
          action_id: STAT_ACTIONS.INCREASE_HEALTH,
          text: { type: 'plain_text', text: 'Increase Vitality', emoji: true },
          style: 'primary',
          value: 'health',
        },
      ],
    },
  ];
};

const resolveXpToNextLevel = (
  player: PlayerStatsSource,
): { needed: number; nextLevel: number } | null => {
  if (
    typeof player.level !== 'number' ||
    typeof player.xpToNextLevel !== 'number'
  ) {
    return null;
  }
  return { needed: player.xpToNextLevel, nextLevel: player.level + 1 };
};

export function buildPlayerStatsMessage(
  player: PlayerStatsSource,
  options: PlayerStatsFormatOptions = {},
) {
  const skillPoints = player.skillPoints ?? 0;
  const name = displayValue(player.name);
  const title = `${name} — Level ${displayValue(player.level)}`;
  const hpText = `${displayValue(player.hp)}/${displayValue(player.maxHp)}`;
  const xpInfo = resolveXpToNextLevel(player);
  const xpFieldValue = xpInfo ? `${xpInfo.needed} XP` : '—';

  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${name}'s Stats`, emoji: true },
    },
  ];

  const incompleteStats = [
    player.strength,
    player.agility,
    player.health,
    player.maxHp,
  ].some((v) => v == null || v === 0);

  if (incompleteStats) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '_Character creation not complete! Use "reroll" to reroll stats, "complete" to finish._',
      },
    });
  }

  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Level*\n${displayValue(player.level)}` },
      { type: 'mrkdwn', text: `*XP*\n${displayValue(player.xp)}` },
      { type: 'mrkdwn', text: `*HP*\n${hpText}` },
      { type: 'mrkdwn', text: `*Gold*\n${displayValue(player.gold)}` },
      { type: 'mrkdwn', text: `*Skill Points*\n${displayValue(skillPoints)}` },
      {
        type: 'mrkdwn',
        text: `*Location*\n${displayValue(player.x)}/${displayValue(player.y)}`,
      },
      { type: 'mrkdwn', text: `*XP to Next Level*\n${xpFieldValue}` },
    ],
  });

  blocks.push({
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Strength*\n${attributeWithModifier(player.strength)}`,
      },
      {
        type: 'mrkdwn',
        text: `*Agility*\n${attributeWithModifier(player.agility)}`,
      },
      {
        type: 'mrkdwn',
        text: `*Vitality*\n${attributeWithGearBonus(
          player.health,
          player.equipmentTotals?.vitalityBonus ?? 0,
        )}`,
      },
    ],
  });

  const equipmentTotals = player.equipmentTotals ?? null;
  const attackBonus = equipmentTotals?.attackBonus ?? 0;
  const damageBonus = equipmentTotals?.damageBonus ?? 0;
  const armorBonus = equipmentTotals?.armorBonus ?? 0;
  const baseAttackModifier = getAbilityModifier(player.strength);
  const baseDamageModifier = getAbilityModifier(player.strength);
  const armorText = formatArmorStat(player.agility, armorBonus);

  blocks.push({
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Attack*\n${formatAttackOrDamageStat(
          baseAttackModifier,
          attackBonus,
        )}`,
      },
      {
        type: 'mrkdwn',
        text: `*Damage*\n${formatAttackOrDamageStat(
          baseDamageModifier,
          damageBonus,
        )}`,
      },
      {
        type: 'mrkdwn',
        text: `*Armor*\n${armorText}`,
      },
    ],
  });

  if (xpInfo) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🏅 ${xpInfo.needed} XP needed for level ${xpInfo.nextLevel}.`,
        },
      ],
    });
  }

  if (options.isSelf) {
    blocks.push(...buildActionsBlock(skillPoints));
  }

  return {
    text: `${title} — HP ${hpText}`,
    blocks,
  };
}

export function buildMonsterStatsMessage(
  monster: MonsterStatsSource,
): SayMessage {
  const name = displayValue(monster.name);
  const hpText = `${displayValue(monster.hp)}/${displayValue(monster.maxHp)}`;
  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${name} (Monster)`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Type*\n${displayValue(monster.type)}` },
        { type: 'mrkdwn', text: `*HP*\n${hpText}` },
        {
          type: 'mrkdwn',
          text: `*Status*\n${monster.isAlive ? 'Alive' : 'Defeated'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Strength*\n${attributeWithModifier(monster.strength)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Agility*\n${attributeWithModifier(monster.agility)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Vitality*\n${attributeWithModifier(monster.health)}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📍 Location: ${displayValue(monster.x)}/${displayValue(monster.y)}`,
        },
      ],
    },
  ];

  return {
    text: `${name} — HP ${hpText}`,
    blocks,
  };
}
