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
    `- Position: ${displayValue(player.x)}/${displayValue(player.y)}`
  );
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
