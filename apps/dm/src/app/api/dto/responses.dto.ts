import type { Player } from './player.dto';
import type { Monster } from './monster.dto';
import type { CombatLog } from './combat-log.dto';
import type { TileInfo } from './tile-info.dto';

export interface LocationInfo {
  location: TileInfo;
  monsters?: Monster[];
  players?: Player[];
  recentCombat?: CombatLog[];
  x: number;
  y: number;
}

export interface TickResult {
  tick: number;
  gameHour: number;
  gameDay: number;
  monstersSpawned: number;
  monstersMoved: number;
  combatEvents: number;
  weatherUpdated: boolean;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

export interface TickSuccessResponse extends SuccessResponse {
  result?: TickResult;
}

export interface PlayerResponse extends SuccessResponse {
  data?: Player;
}

export interface LocationResponse extends SuccessResponse {
  data?: LocationInfo;
}

export interface SniffData {
  detectionRadius: number;
  monsterName?: string;
  distance?: number;
  direction?: string;
  monsterX?: number;
  monsterY?: number;
}

export interface SniffResponse extends SuccessResponse {
  data?: SniffData;
}

export interface MonsterResponse extends SuccessResponse {
  data?: Monster;
}

export interface CombatRound {
  roundNumber: number;
  attackerName: string;
  defenderName: string;
  attackRoll: number;
  attackModifier: number;
  totalAttack: number;
  defenderAC: number;
  hit: boolean;
  damage: number;
  defenderHpAfter: number;
  killed: boolean;
}

export interface InitiativeRoll {
  name: string;
  roll: number;
  modifier: number;
  total: number;
}

export interface CombatLocation {
  x: number;
  y: number;
}

export interface DetailedCombatLog {
  combatId: string;
  participant1: string;
  participant2: string;
  initiativeRolls: InitiativeRoll[];
  firstAttacker: string;
  rounds: CombatRound[];
  winner: string;
  loser: string;
  xpAwarded: number;
  goldAwarded: number;
  timestamp: Date;
  location: CombatLocation;
}

export interface CombatPlayerMessage {
  slackId: string;
  name: string;
  message: string;
  role: string;
}

export interface CombatResult {
  success: boolean;
  winnerName: string;
  loserName: string;
  totalDamageDealt: number;
  roundsCompleted: number;
  xpGained: number;
  goldGained: number;
  message: string;
  playerMessages: CombatPlayerMessage[];
}

export interface CombatResponse extends SuccessResponse {
  data?: CombatResult;
}

export interface GameState {
  currentTime: string;
  totalPlayers: number;
  totalMonsters: number;
}

export interface GameStateResponse extends SuccessResponse {
  data?: GameState;
}

export interface HealthCheck {
  status: string;
  timestamp: string;
}

export interface PlayerStats {
  player: Player;
  strengthModifier: number;
  agilityModifier: number;
  healthModifier: number;
  dodgeChance: number;
  baseDamage: string;
  armorClass: number;
  xpForNextLevel: number;
  xpProgress: number;
  xpNeeded: number;
  recentCombat: CombatLog[];
}

export interface SurroundingTile {
  x: number;
  y: number;
  biomeName: string;
  description?: string;
  direction: string;
}

export interface NearbyPlayerInfo {
  distance: number;
  direction: string;
  x: number;
  y: number;
}

export interface PlayerMoveResponse extends SuccessResponse {
  player: Player;
  monsters: Monster[];
  playersAtLocation: Player[];
}

export interface BiomeSectorSummary {
  biomeName: string;
  proportion: number;
  predominantDirections: string[];
}

export interface VisiblePeakInfo {
  x: number;
  y: number;
  height: number;
  distance: number;
  direction: string;
}

export interface VisibleSettlementInfo {
  name: string;
  type: string;
  size: string;
  distance: number;
  direction: string;
}

export interface CurrentSettlementInfo {
  name: string;
  type: string;
  size: string;
  intensity: number;
  isCenter: boolean;
}

export interface LookViewData {
  location: TileInfo;
  visibilityRadius: number;
  biomeSummary: BiomeSectorSummary[];
  visiblePeaks: VisiblePeakInfo[];
  visibleSettlements: VisibleSettlementInfo[];
  currentSettlement?: CurrentSettlementInfo;
  nearbyPlayers: NearbyPlayerInfo[];
  inSettlement: boolean;
  description: string;
  monsters: Monster[];
}

export interface PerformanceStats {
  totalMs: number;
  playerMs: number;
  worldCenterNearbyMs: number;
  worldBoundsTilesMs: number;
  worldExtendedBoundsMs: number;
  tilesFilterMs: number;
  peaksSortMs: number;
  biomeSummaryMs: number;
  settlementsFilterMs: number;
  aiMs: number;
  tilesCount: number;
  peaksCount: number;
  aiProvider: string;
}

export interface LookViewResponse extends SuccessResponse {
  data?: LookViewData;
  perf?: PerformanceStats;
}
