import { ObjectType, Field, Float, Int } from '@nestjs/graphql';
import { WorldTile } from './world-tile.model';
import { Settlement } from './settlement.model';

@ObjectType()
export class ChunkStats {
  @Field(() => Float)
  averageHeight!: number;

  @Field(() => Float)
  averageTemperature!: number;

  @Field(() => Float)
  averageMoisture!: number;
}

@ObjectType()
export class BiomeCount {
  @Field()
  biomeName!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class PaginatedTiles {
  @Field(() => [WorldTile])
  tiles!: WorldTile[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Int)
  offset!: number;

  @Field(() => Int)
  limit!: number;

  @Field(() => Boolean)
  hasMore!: boolean;
}

@ObjectType()
export class ChunkData {
  @Field(() => Int)
  chunkX!: number;

  @Field(() => Int)
  chunkY!: number;

  // These fields will be resolved by @ResolveField decorators
  @Field(() => [WorldTile], { nullable: true })
  tiles?: WorldTile[];

  @Field(() => PaginatedTiles, { nullable: true })
  paginatedTiles?: PaginatedTiles;

  @Field(() => [Settlement], { nullable: true })
  settlements?: Settlement[];

  @Field(() => ChunkStats, { nullable: true })
  stats?: ChunkStats;

  @Field(() => [BiomeCount], { nullable: true })
  biomeStats?: BiomeCount[];
}
