import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MapTile {
  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;

  @Field(() => String, { nullable: true })
  biomeName?: string;

  @Field(() => String, { nullable: true })
  symbol?: string;

  @Field(() => Boolean)
  hasSettlement!: boolean;

  @Field(() => Boolean)
  isSettlementCenter!: boolean;
}
