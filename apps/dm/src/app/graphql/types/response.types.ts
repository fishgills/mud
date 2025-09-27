import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Player } from '../models/player.model';
import { Monster } from '../models/monster.model';
import { CombatLog } from '../models/combat-log.model';
import { TileInfo } from '../models/tile-info.model';

@ObjectType()
export class LocationInfo {
  @Field(() => TileInfo)
  location!: TileInfo;

  // These fields will be resolved on demand via @ResolveField
  @Field(() => [Monster], { nullable: true })
  monsters?: Monster[];

  @Field(() => [Player], { nullable: true })
  players?: Player[];

  @Field(() => [CombatLog], { nullable: true })
  recentCombat?: CombatLog[];

  // Store coordinates for field resolvers to use
  x!: number;
  y!: number;
}

@ObjectType()
export class TickResult {
  @Field(() => Int)
  tick!: number;

  @Field(() => Int)
  gameHour!: number;

  @Field(() => Int)
  gameDay!: number;

  @Field(() => Int)
  monstersSpawned!: number;

  @Field(() => Int)
  monstersMoved!: number;

  @Field(() => Int)
  combatEvents!: number;

  @Field(() => Boolean)
  weatherUpdated!: boolean;
}

@ObjectType()
export class SuccessResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => TickResult, { nullable: true })
  result?: TickResult;
}

@ObjectType()
export class PlayerResponse extends SuccessResponse {
  @Field(() => Player, { nullable: true })
  data?: Player;
}

@ObjectType()
export class LocationResponse extends SuccessResponse {
  @Field(() => LocationInfo, { nullable: true })
  data?: LocationInfo;
}

@ObjectType()
export class MonsterResponse extends SuccessResponse {
  @Field(() => Monster, { nullable: true })
  data?: Monster;
}

@ObjectType()
export class CombatRound {
  @Field()
  roundNumber!: number;

  @Field()
  attackerName!: string;

  @Field()
  defenderName!: string;

  @Field()
  attackRoll!: number;

  @Field()
  attackModifier!: number;

  @Field()
  totalAttack!: number;

  @Field()
  defenderAC!: number;

  @Field()
  hit!: boolean;

  @Field()
  damage!: number;

  @Field()
  defenderHpAfter!: number;

  @Field()
  killed!: boolean;
}

@ObjectType()
export class InitiativeRoll {
  @Field()
  name!: string;

  @Field()
  roll!: number;

  @Field()
  modifier!: number;

  @Field()
  total!: number;
}

@ObjectType()
export class CombatLocation {
  @Field()
  x!: number;

  @Field()
  y!: number;
}

@ObjectType()
export class DetailedCombatLog {
  @Field()
  combatId!: string;

  @Field()
  participant1!: string;

  @Field()
  participant2!: string;

  @Field(() => [InitiativeRoll])
  initiativeRolls!: InitiativeRoll[];

  @Field()
  firstAttacker!: string;

  @Field(() => [CombatRound])
  rounds!: CombatRound[];

  @Field()
  winner!: string;

  @Field()
  loser!: string;

  @Field()
  xpAwarded!: number;

  @Field()
  goldAwarded!: number;

  @Field()
  timestamp!: Date;

  @Field(() => CombatLocation)
  location!: CombatLocation;
}

@ObjectType()
export class CombatPlayerMessage {
  @Field()
  slackId!: string;

  @Field()
  name!: string;

  @Field()
  message!: string;
}

@ObjectType()
export class CombatResult {
  @Field()
  success!: boolean;

  // @Field(() => DetailedCombatLog)
  // combatLog!: DetailedCombatLog;

  @Field()
  winnerName!: string;

  @Field()
  loserName!: string;

  @Field()
  totalDamageDealt!: number;

  @Field()
  roundsCompleted!: number;

  @Field()
  xpGained!: number;

  @Field()
  goldGained!: number;

  @Field()
  message!: string;

  @Field(() => [CombatPlayerMessage])
  playerMessages!: CombatPlayerMessage[];
}
@ObjectType()
export class CombatResponse extends SuccessResponse {
  @Field(() => CombatResult, { nullable: true })
  data?: CombatResult;
}

@ObjectType()
export class GameState {
  @Field()
  currentTime!: string;

  @Field()
  totalPlayers!: number;

  @Field()
  totalMonsters!: number;
}

@ObjectType()
export class GameStateResponse extends SuccessResponse {
  @Field(() => GameState, { nullable: true })
  data?: GameState;
}

@ObjectType()
export class HealthCheck {
  @Field()
  status!: string;

  @Field()
  timestamp!: string;
}

@ObjectType()
export class PlayerStats {
  @Field(() => Player)
  player!: Player;

  @Field()
  strengthModifier!: number;

  @Field()
  agilityModifier!: number;

  @Field()
  healthModifier!: number;

  @Field()
  dodgeChance!: number;

  @Field()
  baseDamage!: string;

  @Field()
  armorClass!: number;

  @Field()
  xpForNextLevel!: number;

  @Field()
  xpProgress!: number;

  @Field()
  xpNeeded!: number;

  @Field(() => [CombatLog])
  recentCombat!: CombatLog[];
}

@ObjectType()
export class SurroundingTile {
  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;

  @Field()
  biomeName!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  direction!: string;
}

@ObjectType()
export class NearbyPlayerInfo {
  @Field(() => Float)
  distance!: number;

  @Field()
  direction!: string;

  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;
}

@ObjectType()
export class PlayerMoveResponse extends SuccessResponse {
  @Field(() => Player)
  player!: Player;

  @Field(() => [Monster])
  monsters: Monster[] = [];

  @Field(() => [Player])
  playersAtLocation: Player[] = [];
}

// --- Look/Scenic View types ---

@ObjectType()
export class BiomeSectorSummary {
  @Field()
  biomeName!: string;

  @Field(() => Float)
  proportion!: number; // 0..1 of visible tiles

  @Field(() => [String])
  predominantDirections!: string[]; // e.g., ["north", "northeast"]
}

@ObjectType()
export class VisiblePeakInfo {
  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;

  @Field(() => Float)
  height!: number; // 0..1

  @Field(() => Float)
  distance!: number;

  @Field()
  direction!: string;
}

@ObjectType()
export class VisibleSettlementInfo {
  @Field()
  name!: string;

  @Field()
  type!: string; // city, town, village, hamlet

  @Field()
  size!: string; // large, medium, small, tiny

  @Field(() => Float)
  distance!: number;

  @Field()
  direction!: string;
}

@ObjectType()
export class CurrentSettlementInfo {
  @Field()
  name!: string;

  @Field()
  type!: string;

  @Field()
  size!: string;

  @Field(() => Float)
  intensity!: number; // 0..1

  @Field()
  isCenter!: boolean;
}

@ObjectType()
export class LookViewData {
  @Field(() => TileInfo)
  location!: TileInfo; // center tile

  @Field(() => Float)
  visibilityRadius!: number;

  @Field(() => [BiomeSectorSummary])
  biomeSummary!: BiomeSectorSummary[];

  @Field(() => [VisiblePeakInfo])
  visiblePeaks!: VisiblePeakInfo[];

  @Field(() => [VisibleSettlementInfo])
  visibleSettlements!: VisibleSettlementInfo[];

  @Field(() => CurrentSettlementInfo, { nullable: true })
  currentSettlement?: CurrentSettlementInfo;

  @Field(() => [NearbyPlayerInfo], {
    nullable: true,
  })
  nearbyPlayers!: NearbyPlayerInfo[];

  @Field()
  inSettlement!: boolean;

  @Field()
  description!: string;

  @Field(() => [Monster], { nullable: true })
  monsters!: Monster[];
}

@ObjectType()
export class PerformanceStats {
  @Field(() => Float)
  totalMs!: number;

  @Field(() => Float)
  playerMs!: number;

  @Field(() => Float)
  worldCenterNearbyMs!: number;

  @Field(() => Float)
  worldBoundsTilesMs!: number;

  @Field(() => Float)
  worldExtendedBoundsMs!: number;

  @Field(() => Float)
  tilesFilterMs!: number;

  @Field(() => Float)
  peaksSortMs!: number;

  @Field(() => Float)
  biomeSummaryMs!: number;

  @Field(() => Float)
  settlementsFilterMs!: number;

  @Field(() => Float)
  aiMs!: number;

  @Field(() => Int)
  tilesCount!: number;

  @Field(() => Int)
  peaksCount!: number;

  @Field()
  aiProvider!: string;
}

@ObjectType()
export class LookViewResponse extends SuccessResponse {
  @Field(() => LookViewData, { nullable: true })
  data?: LookViewData;

  @Field(() => PerformanceStats, { nullable: true })
  perf?: PerformanceStats;
}
