import { ObjectType, Field, Int } from '@nestjs/graphql';
import { WorldTile } from './world-tile.model';

@ObjectType()
export class Player {
  @Field(() => Int)
  id!: number;

  @Field()
  slackId!: string;

  @Field()
  name!: string;

  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;

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
  gold!: number;

  @Field(() => Int)
  xp!: number;

  @Field(() => Int)
  level!: number;

  @Field()
  isAlive!: boolean;

  @Field()
  lastAction!: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => Int, { nullable: true })
  worldTileId?: number | null;

  // These fields will be resolved by @ResolveField decorators
  @Field(() => WorldTile, { nullable: true })
  worldTile?: WorldTile;
}
