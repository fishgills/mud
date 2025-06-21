import { ObjectType, Field, Int } from '@nestjs/graphql';
import { WorldTile } from './world-tile.model';
import { Monster } from './monster.model';

@ObjectType()
export class Biome {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  // These fields will be resolved by @ResolveField decorators
  @Field(() => [WorldTile], { nullable: true })
  tiles?: WorldTile[];

  @Field(() => [Monster], { nullable: true })
  monsters?: Monster[];
}
