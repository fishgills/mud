export type EquipmentTotals = {
  strengthBonus?: number;
  agilityBonus?: number;
  healthBonus?: number;
  weaponDamageRoll?: string | null;
};

export type PlayerStatsLike = {
  name?: string | null;
  level?: number | null;
  xp?: number | null;
  hp?: number | null;
  maxHp?: number | null;
  gold?: number | null;
  skillPoints?: number | null;
  strength?: number | null;
  agility?: number | null;
  health?: number | null;
  damageRoll?: string | number | null;
  xpToNextLevel?: number | null;
  equipmentTotals?: EquipmentTotals | null;
};

export type CharacterSheetField = {
  label: string;
  value: string;
};

export type CharacterSheetSection = {
  title: string;
  fields: CharacterSheetField[];
};

export type CharacterSheetModel = {
  name: string;
  title: string;
  summaryText: string;
  sections: CharacterSheetSection[];
  xpContext?: string;
  incompleteNotice?: string;
  skillPoints: number;
};

const displayValue = (value: unknown) =>
  value === undefined || value === null ? '—' : String(value);

const formatNumber = (value: number, decimals = 1): string => {
  if (Number.isNaN(value)) return '—';
  if (decimals === 0) return String(Math.round(value));
  return Number.isInteger(value) ? String(value) : value.toFixed(decimals);
};

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const effectiveStat = (stat: number): number => Math.sqrt(Math.max(0, stat));

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
  const baseText =
    gearBonus === 0
      ? ''
      : `, base ${value}, ${gearBonus >= 0 ? '+' : ''}${gearBonus} gear`;
  return `${total} (eff ${formatNumber(effective)}${baseText})`;
};

const parseDice = (dice: string): { count: number; sides: number } => {
  const parts = dice.toLowerCase().split('d');
  if (parts.length !== 2) return { count: 1, sides: 4 };
  const count = parseInt(parts[0], 10);
  const sides = parseInt(parts[1], 10);
  if (Number.isNaN(count) || Number.isNaN(sides)) return { count: 1, sides: 4 };
  return { count, sides };
};

const averageDiceRoll = (count: number, sides: number): number =>
  (count * (sides + 1)) / 2;

const estimateWeaponDamage = (damageRoll: string): number => {
  const { count, sides } = parseDice(damageRoll);
  return averageDiceRoll(count, sides);
};

const calculateAttackRating = (stats: {
  strength: number;
  agility: number;
  level: number;
}): number => 10 * stats.strength + 4 * stats.agility + 6 * stats.level;

const calculateDefenseRating = (stats: {
  agility: number;
  health: number;
  level: number;
}): number => 10 * stats.agility + 2 * stats.health + 6 * stats.level;

const calculateCoreDamage = (stats: {
  strength: number;
  level: number;
}): number => 4 + 2 * stats.strength + 0.5 * stats.level;

const calculateMitigation = (stats: {
  health: number;
  agility: number;
}): number => {
  const toughness = 6 * stats.health + 3 * stats.agility;
  return toughness / (toughness + 100);
};

const resolveXpToNextLevel = (
  player: PlayerStatsLike,
): { needed: number; nextLevel: number } | null => {
  if (
    typeof player.level !== 'number' ||
    typeof player.xpToNextLevel !== 'number'
  ) {
    return null;
  }
  return { needed: player.xpToNextLevel, nextLevel: player.level + 1 };
};

export const buildCharacterSheetModel = (
  player: PlayerStatsLike,
): CharacterSheetModel => {
  const skillPoints = player.skillPoints ?? 0;
  const name = displayValue(player.name);
  const title = `${name} — Level ${displayValue(player.level)}`;
  const hpText = `${displayValue(player.hp)}/${displayValue(player.maxHp)}`;
  const xpInfo = resolveXpToNextLevel(player);
  const xpFieldValue = xpInfo ? `${xpInfo.needed} XP` : '—';

  const incompleteStats = [
    player.strength,
    player.agility,
    player.health,
    player.maxHp,
  ].some((value) => value == null || value === 0);

  const equipmentTotals = player.equipmentTotals ?? null;
  const statBonuses = resolveStatBonuses(equipmentTotals);
  const weaponDamageRoll =
    equipmentTotals?.weaponDamageRoll ??
    (typeof player.damageRoll === 'string' ? player.damageRoll : null) ??
    '1d4';

  const strength = player.strength ?? 0;
  const agility = player.agility ?? 0;
  const health = player.health ?? 0;
  const level = player.level ?? 1;

  const totalStrength = strength + statBonuses.strength;
  const totalAgility = agility + statBonuses.agility;
  const totalHealth = health + statBonuses.health;

  const effectiveStrength = effectiveStat(totalStrength);
  const effectiveAgility = effectiveStat(totalAgility);
  const effectiveHealth = effectiveStat(totalHealth);
  const effectiveLevel = effectiveStat(level);

  const attackRating = calculateAttackRating({
    strength: effectiveStrength,
    agility: effectiveAgility,
    level: effectiveLevel,
  });
  const defenseRating = calculateDefenseRating({
    agility: effectiveAgility,
    health: effectiveHealth,
    level: effectiveLevel,
  });
  const coreDamage = calculateCoreDamage({
    strength: effectiveStrength,
    level: effectiveLevel,
  });
  const baseDamage = coreDamage + estimateWeaponDamage(weaponDamageRoll);
  const mitigation = calculateMitigation({
    health: effectiveHealth,
    agility: effectiveAgility,
  });
  const initiativeBase = 1000 * effectiveAgility + 10 * effectiveLevel;

  const sections: CharacterSheetSection[] = [
    {
      title: 'Summary',
      fields: [
        { label: 'Level', value: displayValue(player.level) },
        { label: 'XP', value: displayValue(player.xp) },
        { label: 'HP', value: hpText },
        { label: 'Gold', value: displayValue(player.gold) },
        { label: 'Skill Points', value: displayValue(skillPoints) },
        { label: 'XP to Next Level', value: xpFieldValue },
      ],
    },
    {
      title: 'Attributes',
      fields: [
        {
          label: 'Strength',
          value: formatStatWithGear(player.strength, statBonuses.strength),
        },
        {
          label: 'Agility',
          value: formatStatWithGear(player.agility, statBonuses.agility),
        },
        {
          label: 'Vitality',
          value: formatStatWithGear(player.health, statBonuses.health),
        },
      ],
    },
    {
      title: 'Combat',
      fields: [
        { label: 'Attack Rating', value: formatNumber(attackRating) },
        { label: 'Defense Rating', value: formatNumber(defenseRating) },
        {
          label: 'Avg Base Damage',
          value: `${formatNumber(baseDamage)} (weapon ${weaponDamageRoll})`,
        },
        { label: 'Mitigation', value: formatPercent(mitigation) },
        { label: 'Initiative', value: formatNumber(initiativeBase, 0) },
      ],
    },
  ];

  return {
    name,
    title: `${name}'s Stats`,
    summaryText: `${title} — HP ${hpText}`,
    sections,
    xpContext: xpInfo
      ? `🏅 ${xpInfo.needed} XP needed for level ${xpInfo.nextLevel}.`
      : undefined,
    incompleteNotice: incompleteStats
      ? 'Character creation not complete. Use the Home tab to reroll, or type `reroll`, then press Start Adventure (or type `complete`).'
      : undefined,
    skillPoints,
  };
};
