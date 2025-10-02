import { ObjectType, Field, Int } from '@nestjs/graphql';
import { WorldTile } from './world-tile.model';

@ObjectType()
export class Biome {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  // These fields will be resolved by @ResolveField decorators
  // Use forward reference to avoid circular dependency
  @Field(() => [WorldTile], { nullable: true })
  tiles?: WorldTile[];
}
