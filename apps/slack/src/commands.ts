// Centralized command strings and Slack action IDs to avoid drift

export const COMMANDS = {
  NEW: 'new',
  HELP: 'help',
  LOOK: 'look',
  LOOK_SHORT: 'l',
  ATTACK: 'attack',
  STATS: 'stats',
  MAP: 'map',
  SNIFF: 'sniff',
  MOVE: 'move',
  DELETE: 'delete',
  COMPLETE: 'complete',
  REROLL: 'reroll',
  INVENTORY: 'inventory',
  PICKUP: 'pickup',
  EQUIP: 'equip',
  DROP: 'drop',
  // Movement (text aliases)
  NORTH: 'north',
  SOUTH: 'south',
  EAST: 'east',
  WEST: 'west',
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
} as const;

export type CommandKey = keyof typeof COMMANDS;

export const MOVEMENT_COMMANDS: string[] = [
  COMMANDS.NORTH,
  COMMANDS.SOUTH,
  COMMANDS.EAST,
  COMMANDS.WEST,
  COMMANDS.UP,
  COMMANDS.DOWN,
  COMMANDS.LEFT,
  COMMANDS.RIGHT,
];

export const HELP_ACTIONS = {
  CREATE: 'help_action_create',
  LOOK: 'help_action_look',
  STATS: 'help_action_stats',
  MAP: 'help_action_map',
  INVENTORY: 'help_action_inventory',
  LEVELING: 'help_action_leveling',
  COMBAT: 'help_action_combat',
  ABILITIES: 'help_action_abilities',
} as const;

// Action IDs for movement quick buttons in Block Kit
export const MOVE_ACTIONS = {
  NORTH: 'move_action_north',
  SOUTH: 'move_action_south',
  EAST: 'move_action_east',
  WEST: 'move_action_west',
} as const;

export const ATTACK_ACTIONS = {
  MONSTER_SELECT: 'attack_action_monster_select',
  ATTACK_MONSTER: 'attack_action_attack_monster',
} as const;

export const PICKUP_ACTIONS = {
  ITEM_SELECT: 'pickup_action_item_select',
  PICKUP: 'pickup_action_pickup',
} as const;

export const STAT_ACTIONS = {
  INCREASE_STRENGTH: 'stats_action_increase_strength',
  INCREASE_AGILITY: 'stats_action_increase_agility',
  INCREASE_HEALTH: 'stats_action_increase_health',
} as const;

// Combat message interactions
export const COMBAT_ACTIONS = {
  SHOW_LOG: 'combat_action_show_log',
  HIDE_LOG: 'combat_action_hide_log',
} as const;
