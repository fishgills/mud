import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerService } from './player/player.service';
import { MonsterService } from './monster/monster.service';
import { CombatService } from './combat/combat.service';
import { EncounterService } from './encounter/encounter.service';
import { GameTickService } from './game-tick/game-tick.service';
import { WorldService } from './world/world.service';
import { AiModule } from '../openai/ai.module';
import { PlayerResolver, SystemResolver, MovementResolver } from './graphql';
import { CoordinationService } from '../shared/coordination.service';
import { EventBridgeService } from '../shared/event-bridge.service';
import {
  VisibilityService,
  PeakService,
  BiomeService,
  SettlementService,
  DescriptionService,
  ResponseService,
} from './graphql/services';
import { PopulationService } from './monster/population.service';
import { PrefetchService } from './prefetch/prefetch.service';
import { PlayerNotificationService } from './player/player-notification.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'dm-schema.gql',
    }),
    AiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PlayerService,
    MonsterService,
    CombatService,
    EncounterService,
    GameTickService,
    WorldService,
    CoordinationService,
    EventBridgeService,
    PlayerResolver,
    MovementResolver,
    SystemResolver,
    VisibilityService,
    PeakService,
    BiomeService,
    SettlementService,
    DescriptionService,
    ResponseService,
    PopulationService,
    PrefetchService,
    PlayerNotificationService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
