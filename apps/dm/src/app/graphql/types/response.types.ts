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
export class SuccessResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;
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
export class CombatResult {
  @Field()
  success!: boolean;

  @Field()
  damage!: number;

  @Field()
  attackerName!: string;

  @Field()
  defenderName!: string;

  @Field()
  defenderHp!: number;

  @Field()
  defenderMaxHp!: number;

  @Field()
  isDead!: boolean;

  @Field()
  message!: string;

  @Field({ nullable: true })
  xpGained?: number;
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
export class PlayerMovementData {
  @Field(() => Player)
  player!: Player;

  @Field(() => TileInfo)
  location!: TileInfo;

  @Field(() => [Monster])
  monsters!: Monster[];

  @Field(() => [NearbyPlayerInfo], { nullable: true })
  nearbyPlayers?: NearbyPlayerInfo[];

  @Field()
  playerInfo!: string;

  @Field(() => [SurroundingTile])
  surroundingTiles!: SurroundingTile[];

  @Field()
  description!: string;

  // Enhanced settlement and biome data (when available)
  @Field(() => [String], { nullable: true })
  nearbyBiomes?: string[];

  @Field(() => [String], { nullable: true })
  nearbySettlements?: string[];

  @Field({ nullable: true })
  currentSettlement?: string;
}

@ObjectType()
export class PlayerMoveResponse extends SuccessResponse {
  @Field(() => PlayerMovementData, { nullable: true })
  data?: PlayerMovementData;
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

  @Field()
  description!: string; // panoramic prose (not persisted)
}

@ObjectType()
export class LookViewResponse extends SuccessResponse {
  @Field(() => LookViewData, { nullable: true })
  data?: LookViewData;
}
