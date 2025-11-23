import { Player } from '@mud/database';
import { calculateAC, getModifier } from '../combat/engine';
import type { EquipmentTotals } from './equipment.effects';

export type PlayerCombatSnapshot = {
  attackModifier: number;
  damageModifier: number;
  damageRoll: string;
  armorClass: number;
  gear: EquipmentTotals;
};

/**
 * Compute normalized combat stats for a player using current equipment totals.
 * Centralizes how modifiers, AC, and weapon dice are derived.
 */
export function computePlayerCombatStats(
  player: Player & { equipmentTotals?: EquipmentTotals },
): PlayerCombatSnapshot {
  const gear: EquipmentTotals = {
    attackBonus: player.equipmentTotals?.attackBonus ?? 0,
    damageBonus: player.equipmentTotals?.damageBonus ?? 0,
    armorBonus: player.equipmentTotals?.armorBonus ?? 0,
    vitalityBonus: player.equipmentTotals?.vitalityBonus ?? 0,
    weaponDamageRoll: player.equipmentTotals?.weaponDamageRoll ?? '1d4',
  };

  const baseAttack = getModifier(player.strength);
  const baseDamage = getModifier(player.strength);
  const attackModifier = baseAttack + gear.attackBonus;
  const damageModifier = baseDamage + gear.damageBonus;
  const armorClass = calculateAC(player.agility) + gear.armorBonus;

  return {
    attackModifier,
    damageModifier,
    damageRoll: gear.weaponDamageRoll ?? '1d4',
    armorClass,
    gear,
  };
}
