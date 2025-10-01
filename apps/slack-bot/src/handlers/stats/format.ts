import { MonsterStatsSource, PlayerStatsSource } from './types';

const displayValue = (value: unknown) =>
  value === undefined || value === null ? '?' : value;

export function formatPlayerStats(player: PlayerStatsSource): string {
  const incomplete = [
    player.strength,
    player.agility,
    player.health,
    player.maxHp,
  ].some((v) => v == null || v === 0)
    ? '_Character creation not complete! Use "reroll" to reroll stats, "complete" to finish._\n'
    : '';

  return (
    `${incomplete}` +
    `*Stats*\n` +
    `- Name: ${displayValue(player.name)}\n` +
    `- Strength: ${displayValue(player.strength)}\n` +
    `- Agility: ${displayValue(player.agility)}\n` +
    `- Health: ${displayValue(player.health)}\n` +
    `- HP: ${displayValue(player.hp)}/${displayValue(player.maxHp)}\n` +
    `- Gold: ${displayValue(player.gold)}\n` +
    `- XP: ${displayValue(player.xp)}\n` +
    `- Level: ${displayValue(player.level)}\n` +
    `- Skill Points: ${displayValue(player.skillPoints ?? 0)}\n` +
    `- Position: ${displayValue(player.x)}/${displayValue(player.y)}`
  );
}

export function formatPlayerStatsBlocks(player: PlayerStatsSource): any[] {
  const incomplete = [
    player.strength,
    player.agility,
    player.health,
    player.maxHp,
  ].some((v) => v == null || v === 0);

  const blocks: any[] = [];

  // Header section
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `⚔️ ${player.name}'s Stats`,
      emoji: true,
    },
  });

  if (incomplete) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '_Character creation not complete! Use "reroll" to reroll stats, "complete" to finish._',
      },
    });
  }

  // Calculate XP progress
  const currentLevel = player.level ?? 1;
  const xp = player.xp ?? 0;
  const xpForNextLevel = currentLevel * 100;

  // Main stats section
  blocks.push({
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Level:*\n${displayValue(player.level)}`,
      },
      {
        type: 'mrkdwn',
        text: `*XP:*\n${displayValue(xp)} / ${xpForNextLevel}`,
      },
      {
        type: 'mrkdwn',
        text: `*HP:*\n${displayValue(player.hp)} / ${displayValue(player.maxHp)}`,
      },
      {
        type: 'mrkdwn',
        text: `*Gold:*\n💰 ${displayValue(player.gold)}`,
      },
    ],
  });

  blocks.push({ type: 'divider' });

  // Attributes section
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Attributes*',
    },
  });

  blocks.push({
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Strength:*\n💪 ${displayValue(player.strength)}`,
      },
      {
        type: 'mrkdwn',
        text: `*Agility:*\n🏃 ${displayValue(player.agility)}`,
      },
      {
        type: 'mrkdwn',
        text: `*Health:*\n❤️ ${displayValue(player.health)}`,
      },
      {
        type: 'mrkdwn',
        text: `*Skill Points:*\n⭐ ${displayValue(player.skillPoints ?? 0)}`,
      },
    ],
  });

  // Show skill point buttons if player has skill points available
  const skillPoints = player.skillPoints ?? 0;
  if (skillPoints > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `You have *${skillPoints}* skill point${skillPoints > 1 ? 's' : ''} available! Click a button below to increase a stat:`,
      },
    });

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '💪 Strength',
            emoji: true,
          },
          value: 'strength',
          action_id: 'increase_skill_strength',
          style: 'primary',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🏃 Agility',
            emoji: true,
          },
          value: 'agility',
          action_id: 'increase_skill_agility',
          style: 'primary',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '❤️ Health',
            emoji: true,
          },
          value: 'health',
          action_id: 'increase_skill_health',
          style: 'primary',
        },
      ],
    });
  }

  blocks.push({ type: 'divider' });

  // Location
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `📍 Position: (${displayValue(player.x)}, ${displayValue(player.y)})`,
      },
    ],
  });

  return blocks;
}

export function formatMonsterStats(monster: MonsterStatsSource): string {
  return (
    `*Monster Stats*\n` +
    `- Name: ${displayValue(monster.name)}\n` +
    `- Type: ${displayValue(monster.type)}\n` +
    `- Strength: ${displayValue(monster.strength)}\n` +
    `- Agility: ${displayValue(monster.agility)}\n` +
    `- Health: ${displayValue(monster.health)}\n` +
    `- HP: ${displayValue(monster.hp)}/${displayValue(monster.maxHp)}\n` +
    `- Status: ${monster.isAlive ? 'Alive' : 'Defeated'}\n` +
    `- Position: ${displayValue(monster.x)}/${displayValue(monster.y)}`
  );
}
