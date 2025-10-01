import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Biome {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  // These fields will be resolved by @ResolveField decorators
  // Use forward reference to avoid circular dependency
  @Field(() => [require('./world-tile.model').WorldTile], { nullable: true })
  tiles?: any[];
}
