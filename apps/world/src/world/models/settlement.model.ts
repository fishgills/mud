import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Settlement {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field()
  type!: string;

  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;

  @Field()
  size!: string;

  @Field(() => Int)
  population!: number;

  @Field()
  description!: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
