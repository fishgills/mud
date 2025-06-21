import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class CombatLog {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  attackerId!: number;

  @Field()
  attackerType!: string;

  @Field(() => Int)
  defenderId!: number;

  @Field()
  defenderType!: string;

  @Field(() => Int)
  damage!: number;

  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;

  @Field()
  timestamp!: Date;
}
