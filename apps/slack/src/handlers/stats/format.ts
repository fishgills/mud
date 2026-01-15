import type { KnownBlock, Block } from '@slack/types';
import { buildCharacterSheetModel } from '@mud/character-sheet';
import { SayMessage } from '../types';
import { MonsterStatsSource, PlayerStatsSource } from './types';

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

export function buildPlayerStatsMessage(
  player: PlayerStatsSource,
) {
  const sheet = buildCharacterSheetModel(player);

  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: sheet.title, emoji: true },
    },
  ];

  if (sheet.incompleteNotice) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `_${sheet.incompleteNotice}_`,
      },
    });
  }

  sheet.sections.forEach((section) => {
    blocks.push({
      type: 'section',
      fields: section.fields.map((field) => ({
        type: 'mrkdwn',
        text: `*${field.label}*\n${field.value}`,
      })),
    });
  });

  if (sheet.xpContext) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: sheet.xpContext,
        },
      ],
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `✨ Skill points available: ${sheet.skillPoints}`,
      },
    ],
  });

  return {
    text: sheet.summaryText,
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
  ];

  return {
    text: `${name} — HP ${hpText}`,
    blocks,
  };
}
