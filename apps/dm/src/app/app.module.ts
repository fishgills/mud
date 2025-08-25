import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerService } from './player/player.service';
import { MonsterService } from './monster/monster.service';
import { CombatService } from './combat/combat.service';
import { GameTickService } from './game-tick/game-tick.service';
import { WorldService } from './world/world.service';
import { OpenaiModule } from '../openai/openai.module';
import { PlayerResolver, SystemResolver, MovementResolver } from './graphql';
import { CoordinationService } from '../shared/coordination.service';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'dm-schema.gql',
    }),
    OpenaiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PlayerService,
    MonsterService,
    CombatService,
    GameTickService,
    WorldService,
    CoordinationService,
    PlayerResolver,
    MovementResolver,
    SystemResolver,
  ],
})
export class AppModule {}
