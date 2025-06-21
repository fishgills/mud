import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class GameState {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  tick!: number;

  @Field(() => Int)
  gameHour!: number;

  @Field(() => Int)
  gameDay!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
