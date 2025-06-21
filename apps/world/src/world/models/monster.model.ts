import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Biome } from './biome.model';
import { WorldTile } from './world-tile.model';

@ObjectType()
export class Monster {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field()
  type!: string;

  @Field(() => Int)
  hp!: number;

  @Field(() => Int)
  maxHp!: number;

  @Field(() => Int)
  strength!: number;

  @Field(() => Int)
  agility!: number;

  @Field(() => Int)
  health!: number;

  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;

  @Field()
  isAlive!: boolean;

  @Field()
  lastMove!: Date;

  @Field()
  spawnedAt!: Date;

  @Field(() => Int)
  biomeId!: number;

  @Field(() => Int, { nullable: true })
  worldTileId?: number | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  // These fields will be resolved by @ResolveField decorators
  @Field(() => Biome, { nullable: true })
  biome?: Biome;

  @Field(() => WorldTile, { nullable: true })
  worldTile?: WorldTile;
}
