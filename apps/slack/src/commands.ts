// Centralized command strings and Slack action IDs to avoid drift

export const COMMANDS = {
  NEW: 'new',
  HELP: 'help',
  LOOK: 'look',
  LOOK_SHORT: 'l',
  ATTACK: 'attack',
  INSPECT: 'inspect',
  STATS: 'stats',
  MAP: 'map',
  SNIFF: 'sniff',
  MOVE: 'move',
  GUILD: 'guild',
  BUY: 'buy',
  SELL: 'sell',
  DELETE: 'delete',
  COMPLETE: 'complete',
  REROLL: 'reroll',
  INVENTORY: 'inventory',
  PICKUP: 'pickup',
  EQUIP: 'equip',
  LOOT: 'loot',
  CATALOG: 'catalog',
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
  HOW_TO_PLAY: 'help_action_how_to_play',
  COMMAND_REFERENCE: 'help_action_command_reference',
  REPORT_ISSUE: 'help_action_report_issue',
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

export const INSPECT_ACTIONS = {
  TARGET_SELECT: 'inspect_action_target_select',
  INSPECT_TARGET: 'inspect_action_inspect_target',
} as const;

export const PICKUP_ACTIONS = {
  ITEM_SELECT: 'pickup_action_item_select',
  PICKUP: 'pickup_action_pickup',
} as const;

export const STAT_ACTIONS = {
  OPEN_LEVEL_UP: 'stats_action_open_level_up',
} as const;

export const HOME_ACTIONS = {
  RESUME: 'home_action_resume',
  VIEW_STATS: 'home_action_view_stats',
  VIEW_LEADERBOARD: 'home_action_view_leaderboard',
  DELETE_CHARACTER: 'home_action_delete_character',
} as const;

export const CHARACTER_ACTIONS = {
  REROLL: 'character_action_reroll',
  DELETE_CONFIRM: 'character_action_delete_confirm',
} as const;

// Combat message interactions
export const COMBAT_ACTIONS = {
  SHOW_LOG: 'combat_action_show_log',
  HIDE_LOG: 'combat_action_hide_log',
} as const;

export const GUILD_SHOP_ACTIONS = {
  BUY: 'guild_shop_action_buy',
  SELL: 'guild_shop_action_sell',
} as const;

export const FEEDBACK_ACTIONS = {
  OPEN_MODAL: 'feedback_open_modal',
  DELETE: 'feedback_delete',
} as const;
