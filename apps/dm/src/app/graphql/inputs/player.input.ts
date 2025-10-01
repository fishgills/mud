import { InputType, Field, Int, registerEnumType } from '@nestjs/graphql';

export enum TargetType {
  PLAYER = 'player',
  MONSTER = 'monster',
}

registerEnumType(TargetType, {
  name: 'TargetType',
});

export enum Direction {
  NORTH = 'n',
  EAST = 'e',
  SOUTH = 's',
  WEST = 'w',
}

registerEnumType(Direction, {
  name: 'Direction',
  description: 'Cardinal directions for player movement',
});

export enum PlayerAttribute {
  STRENGTH = 'strength',
  AGILITY = 'agility',
  HEALTH = 'health',
}

registerEnumType(PlayerAttribute, {
  name: 'PlayerAttribute',
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
  @Field(() => Direction, { nullable: true })
  direction?: Direction;

  @Field(() => Int, { nullable: true })
  x?: number;

  @Field(() => Int, { nullable: true })
  y?: number;
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

  // For monsters, target by numeric ID
  @Field(() => Int, { nullable: true })
  targetId?: number;

  // For players, allow targeting by Slack ID (within same workspace)
  @Field({ nullable: true })
  targetSlackId?: string;

  // When attacking by Slack ID, allow bypassing location restriction
  @Field({ nullable: true })
  ignoreLocation?: boolean;
}

@InputType()
export class SpawnMonsterInput {
  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;
}
