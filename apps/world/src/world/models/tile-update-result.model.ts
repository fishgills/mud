import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class TileUpdateResult {
  @Field()
  success!: boolean;

  @Field()
  message!: string;
}
