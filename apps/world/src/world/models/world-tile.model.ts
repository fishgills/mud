import 'reflect-metadata';
import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Biome } from './biome.model';

@ObjectType()
export class WorldTile {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;

  @Field(() => Int)
  biomeId!: number;

  @Field()
  biomeName!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Float)
  height!: number;

  @Field(() => Float)
  temperature!: number;

  @Field(() => Float)
  moisture!: number;

  @Field(() => Int)
  seed!: number;

  @Field(() => Int)
  chunkX!: number;

  @Field(() => Int)
  chunkY!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  // These fields will be resolved by @ResolveField decorators
  @Field(() => Biome, { nullable: true })
  biome?: Biome;
}
