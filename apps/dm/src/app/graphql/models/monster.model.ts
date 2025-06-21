import { ObjectType, Field, Int, ID } from '@nestjs/graphql';

@ObjectType()
export class Monster {
  @Field(() => ID)
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
  worldTileId?: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
