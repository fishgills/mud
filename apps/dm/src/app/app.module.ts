import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerService } from './player/player.service';
import { MonsterService } from './monster/monster.service';
import { CombatService } from './combat/combat.service';
import { EncounterService } from './encounter/encounter.service';
import { GameTickService } from './game-tick/game-tick.service';
import { WorldService } from './world/world.service';
import { AiModule } from '../openai/ai.module';
import {
  PlayersController,
  MovementController,
  SystemController,
  ItemController,
  LocationController,
} from './api/controllers';
import { CoordinationService } from '../shared/coordination.service';
import { EventBridgeService } from '../shared/event-bridge.service';
import {
  VisibilityService,
  PeakService,
  BiomeService,
  SettlementService,
  DescriptionService,
  ResponseService,
} from './api/services';
import { PopulationService } from './monster/population.service';
import { PrefetchService } from './prefetch/prefetch.service';
import { PlayerNotificationService } from './player/player-notification.service';
import { LocationNotificationService } from './notifications/location-notification.service';
import { PlayerItemService } from './player/player-item.service';
import { LootService } from './monster/loot.service';

@Module({
  imports: [AiModule],
  controllers: [
    AppController,
    PlayersController,
    MovementController,
    SystemController,
    ItemController,
    LocationController,
  ],
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
    LocationNotificationService,
    PlayerItemService,
    LootService,
  ],
})
export class AppModule {}
