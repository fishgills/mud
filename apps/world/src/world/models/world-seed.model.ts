import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class WorldSeed {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  seed!: number;

  @Field(() => Int)
  heightSeed!: number;

  @Field(() => Int)
  temperatureSeed!: number;

  @Field(() => Int)
  moistureSeed!: number;

  @Field(() => Float)
  heightScale!: number;

  @Field(() => Float)
  temperatureScale!: number;

  @Field(() => Float)
  moistureScale!: number;

  @Field(() => Int)
  heightOctaves!: number;

  @Field(() => Int)
  temperatureOctaves!: number;

  @Field(() => Int)
  moistureOctaves!: number;

  @Field(() => Float)
  heightPersistence!: number;

  @Field(() => Float)
  temperaturePersistence!: number;

  @Field(() => Float)
  moisturePersistence!: number;

  @Field(() => Float)
  heightLacunarity!: number;

  @Field(() => Float)
  temperatureLacunarity!: number;

  @Field(() => Float)
  moistureLacunarity!: number;

  @Field()
  isActive!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
