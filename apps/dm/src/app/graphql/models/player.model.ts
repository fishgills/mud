import { ObjectType, Field, Int, ID } from '@nestjs/graphql';
import { TileInfo } from './tile-info.model';
import { Monster } from './monster.model';

@ObjectType()
export class Player {
  @Field(() => ID)
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

  @Field(() => Int)
  skillPoints!: number;

  @Field()
  isAlive!: boolean;

  @Field({ nullable: true })
  lastAction?: Date;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => Int, { nullable: true })
  worldTileId?: number | null;

  // Fields resolved on demand via @ResolveField
  @Field(() => TileInfo, { nullable: true })
  currentTile?: TileInfo;

  @Field(() => [Player], { nullable: true })
  nearbyPlayers?: Player[];

  @Field(() => [Monster], { nullable: true })
  nearbyMonsters?: Monster[];
}
