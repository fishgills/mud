/**
 * Dice rolling helpers for character generation and combat.
 */

/**
 * Roll 4d6 and drop the lowest die, returning the sum of the top three.
 *
 * This mirrors the classic D&D ability score generation method.
 */
export function rollAbilityScore(): number {
  const rolls = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];

  rolls.sort((a, b) => a - b);

  return rolls[1] + rolls[2] + rolls[3];
}
