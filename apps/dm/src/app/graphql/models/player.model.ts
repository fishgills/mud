import { ObjectType, Field, Int, ID } from '@nestjs/graphql';
import { TileInfo } from './tile-info.model';
import { Monster } from './monster.model';

@ObjectType()
export class Player {
  @Field(() => ID)
  id!: number;

  @Field(() => String, {
    nullable: true,
    deprecationReason: 'Use clientId instead',
  })
  slackId?: string | null;

  @Field(() => String, { nullable: true })
  clientId?: string | null;

  @Field(() => String, { nullable: true })
  clientType?: string | null;

  @Field(() => String)
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

  @Field(() => Boolean)
  isAlive!: boolean;

  @Field(() => Date, { nullable: true })
  lastAction?: Date;

  @Field(() => Date, { nullable: true })
  createdAt?: Date;

  @Field(() => Date)
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
