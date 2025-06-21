import { InputType, Field, Int, registerEnumType } from '@nestjs/graphql';

export enum TargetType {
  PLAYER = 'player',
  MONSTER = 'monster',
}

registerEnumType(TargetType, {
  name: 'TargetType',
});

@InputType()
export class CreatePlayerInput {
  @Field()
  slackId!: string;

  @Field()
  name!: string;

  @Field(() => Int, { nullable: true })
  x?: number;

  @Field(() => Int, { nullable: true })
  y?: number;
}

@InputType()
export class MovePlayerInput {
  @Field()
  direction!: string;
}

@InputType()
export class PlayerStatsInput {
  @Field(() => Int, { nullable: true })
  hp?: number;

  @Field(() => Int, { nullable: true })
  xp?: number;

  @Field(() => Int, { nullable: true })
  gold?: number;

  @Field(() => Int, { nullable: true })
  level?: number;
}

@InputType()
export class AttackInput {
  @Field(() => TargetType)
  targetType!: TargetType;

  @Field(() => Int)
  targetId!: number;
}

@InputType()
export class SpawnMonsterInput {
  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;
}
