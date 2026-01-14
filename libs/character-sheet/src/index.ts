export type EquipmentTotals = {
  attackBonus?: number;
  damageBonus?: number;
  armorBonus?: number;
  vitalityBonus?: number;
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
  const attackBonus = equipmentTotals?.attackBonus ?? 0;
  const damageBonus = equipmentTotals?.damageBonus ?? 0;
  const armorBonus = equipmentTotals?.armorBonus ?? 0;
  const weaponDamageRoll =
    equipmentTotals?.weaponDamageRoll ??
    (typeof player.damageRoll === 'string' ? player.damageRoll : null) ??
    '1d4';
  const baseAttackModifier = getAbilityModifier(player.strength);
  const baseDamageModifier = getAbilityModifier(player.strength);
  const armorText = formatArmorStat(player.agility, armorBonus);

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
        { label: 'Strength', value: attributeWithModifier(player.strength) },
        { label: 'Agility', value: attributeWithModifier(player.agility) },
        {
          label: 'Vitality',
          value: attributeWithGearBonus(
            player.health,
            equipmentTotals?.vitalityBonus ?? 0,
          ),
        },
      ],
    },
    {
      title: 'Combat',
      fields: [
        {
          label: 'Attack',
          value: formatAttackOrDamageStat(baseAttackModifier, attackBonus),
        },
        {
          label: 'Damage',
          value: `${formatAttackOrDamageStat(
            baseDamageModifier,
            damageBonus,
          )} (${weaponDamageRoll})`,
        },
        { label: 'Armor', value: armorText },
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
