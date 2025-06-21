import { ObjectType, Field, Float, Int } from '@nestjs/graphql';
import { WorldTile } from './world-tile.model';

@ObjectType()
export class NearbyBiome {
  @Field()
  biomeName!: string;

  @Field(() => Float)
  distance!: number;

  @Field()
  direction!: string;
}

@ObjectType()
export class NearbySettlement {
  @Field()
  name!: string;

  @Field()
  type!: string;

  @Field()
  size!: string;

  @Field(() => Int)
  population!: number;

  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;

  @Field()
  description!: string;

  @Field(() => Float)
  distance!: number;
}

@ObjectType()
export class CurrentSettlement {
  @Field()
  name!: string;

  @Field()
  type!: string;

  @Field()
  size!: string;

  @Field(() => Float)
  intensity!: number;

  @Field()
  isCenter!: boolean;
}

@ObjectType()
export class TileWithNearbyBiomes extends WorldTile {
  @Field(() => [NearbyBiome])
  nearbyBiomes!: NearbyBiome[];

  @Field(() => [NearbySettlement])
  nearbySettlements!: NearbySettlement[];

  @Field(() => CurrentSettlement, { nullable: true })
  currentSettlement?: CurrentSettlement;
}
