import type { CombatLog } from './combat-log.dto';
import type { TileInfo } from './tile-info.dto';
import type { AttackOrigin } from './player-requests.dto';
import { Monster, Player } from '@mud/database';

export interface EquipmentTotalsDto {
  attackBonus: number;
  damageBonus: number;
  armorBonus: number;
  vitalityBonus: number;
}

export type PlayerWithEquipmentTotals = Player & {
  equipmentTotals?: EquipmentTotalsDto;
  xpToNextLevel?: number;
};

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
  weatherUpdated: boolean;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
  code?: string;
}

export interface TickSuccessResponse extends SuccessResponse {
  result?: TickResult;
}

export interface PlayerResponse extends SuccessResponse {
  data?: PlayerWithEquipmentTotals;
}

export interface LocationResponse extends SuccessResponse {
  data?: LocationInfo;
}

export type SniffProximity =
  | 'immediate'
  | 'close'
  | 'near'
  | 'far'
  | 'distant'
  | 'unknown';

export interface SniffData {
  detectionRadius: number;
  monsterName?: string;
  distanceLabel?: string;
  proximity?: SniffProximity;
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
  // Bonus breakdown for transparency
  baseAttackModifier?: number;
  attackBonus?: number;
  baseDefenderAC?: number;
  armorBonus?: number;
  baseDamage?: number;
  damageBonus?: number;
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
  teamId: string;
  userId: string;
  name: string;
  message: string;
  role: string;
  blocks?: Array<Record<string, unknown>>;
}

export interface CombatMessagePerformance {
  totalMs: number;
  attackerMessageMs?: number;
  defenderMessageMs?: number;
  observerNarrativeMs?: number;
  observerSummaryMs?: number;
  observerLookupMs?: number;
}

export interface CombatPerformanceBreakdown {
  totalMs: number;
  loadCombatantsMs: number;
  validationMs: number;
  runCombatMs: number;
  applyResultsMs: number;
  messagePrepMs: number;
  notificationMs: number;
  messageDetails?: CombatMessagePerformance;
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
  perfBreakdown?: CombatPerformanceBreakdown;
}

export interface AttackPerformanceStats {
  totalMs: number;
  preCombatMs: number;
  combatMs: number;
  targetResolutionMs?: number;
  combatBreakdown?: CombatPerformanceBreakdown;
  attackOrigin?: AttackOrigin;
}

export interface CombatResponse extends SuccessResponse {
  data?: CombatResult;
  perf?: AttackPerformanceStats;
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

export type TeleportState = 'entered' | 'awaiting_choice' | 'exited';

export interface TeleportResponse extends SuccessResponse {
  state: TeleportState;
  player?: Player;
  destination?: { x: number; y: number };
  lastWorldPosition?: { x: number | null; y: number | null };
  mode?: 'return' | 'random';
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

export interface LookViewData {
  location: TileInfo;
  visibilityRadius: number;
  biomeSummary: BiomeSectorSummary[];
  visiblePeaks: VisiblePeakInfo[];
  nearbyPlayers: NearbyPlayerInfo[];
  description: string;
  monsters: Monster[];
  items?: Array<{
    id: number;
    itemId: number;
    quantity?: number;
    quality?: string | null;
    itemName?: string | null;
    x?: number;
    y?: number;
  }>;
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
  aiMs: number;
  tilesCount: number;
  peaksCount: number;
  aiProvider: string;
}

export interface LookViewResponse extends SuccessResponse {
  data?: LookViewData;
  perf?: PerformanceStats;
}
