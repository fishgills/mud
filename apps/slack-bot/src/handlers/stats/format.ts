import type { KnownBlock, Block } from '@slack/types';
import { SayMessage } from '../types';
import { MonsterStatsSource, PlayerStatsSource } from './types';
import { STAT_ACTIONS } from '../../commands';

type PlayerStatsFormatOptions = {
  isSelf?: boolean;
};

const displayValue = (value: unknown) =>
  value === undefined || value === null ? '—' : String(value);

const attributeWithModifier = (value: number | null | undefined): string => {
  if (value == null) {
    return '—';
  }
  const modifier = Math.floor((value - 10) / 2);
  const sign = modifier >= 0 ? '+' : '';
  return `${value} (${sign}${modifier})`;
};

const buildActionsBlock = (skillPoints: number): (KnownBlock | Block)[] => {
  if (!skillPoints || skillPoints <= 0) {
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

export function buildPlayerStatsMessage(
  player: PlayerStatsSource,
  options: PlayerStatsFormatOptions = {},
): SayMessage {
  const skillPoints = player.skillPoints ?? 0;
  const name = displayValue(player.name);
  const title = `${name} — Level ${displayValue(player.level)}`;
  const hpText = `${displayValue(player.hp)}/${displayValue(player.maxHp)}`;

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
        text: `*Vitality*\n${attributeWithModifier(player.health)}`,
      },
    ],
  });

  if (typeof player.level === 'number' && typeof player.xp === 'number') {
    const xpForNextLevel = player.level * 100;
    const xpNeeded = Math.max(0, xpForNextLevel - player.xp);
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text:
            xpNeeded > 0
              ? `🏅 ${xpNeeded} XP needed for level ${player.level + 1}.`
              : `🏅 You have enough XP to reach the next level!`,
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
