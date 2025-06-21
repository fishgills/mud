import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType()
export class TileInfo {
  @Field(() => Float)
  x!: number;

  @Field(() => Float)
  y!: number;

  @Field()
  biomeName!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Float)
  height!: number;

  @Field(() => Float)
  temperature!: number;

  @Field(() => Float)
  moisture!: number;
}
