import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TsRestHandlerInterceptor } from '@ts-rest/nest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerService } from './player/player.service';
import { MonsterService } from './monster/monster.service';
import { CombatService } from './combat/combat.service';
import { EncounterService } from './encounter/encounter.service';
import { GameTickService } from './game-tick/game-tick.service';
import { WorldService } from './world/world.service';
import { AiModule } from '../openai/ai.module';
import { CoordinationService } from '../shared/coordination.service';
import { EventBridgeService } from '../shared/event-bridge.service';
import { VisibilityService } from './look-view/visibility.service';
import { PeakService } from './look-view/peak.service';
import { BiomeService } from './look-view/biome.service';
import { SettlementService } from './look-view/settlement.service';
import { DescriptionService } from './look-view/description.service';
import { ResponseService } from './look-view/response.service';
import { PopulationService } from './monster/population.service';
import { PrefetchService } from './prefetch/prefetch.service';
import { PlayerNotificationService } from './player/player-notification.service';
import { DmApiController } from './api/dm-api.controller';

@Module({
  imports: [AiModule],
  controllers: [AppController, DmApiController],
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
      useClass: TsRestHandlerInterceptor,
    },
  ],
})
export class AppModule {}
