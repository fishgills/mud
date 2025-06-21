import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class WeatherState {
  @Field(() => Int)
  id!: number;

  @Field()
  state!: string;

  @Field(() => Int)
  pressure!: number;

  @Field()
  updatedAt!: Date;
}
