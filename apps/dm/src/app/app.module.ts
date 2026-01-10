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
  LootController,
} from './api/controllers';
import { GuildShopController } from '../modules/guild-shop/guild-shop.controller';
import { GuildAnnouncementsController } from '../modules/guild-announcements/guild-announcements.controller';
import { FeedbackController } from '../modules/feedback/feedback.controller';
import { CoordinationService } from '../shared/coordination.service';
import { EventBridgeService } from '../shared/event-bridge.service';
import {
  VisibilityService,
  PeakService,
  BiomeService,
  DescriptionService,
  ResponseService,
} from './api/services';
import { PopulationService } from './monster/population.service';
import { PrefetchService } from './prefetch/prefetch.service';
import { PlayerNotificationService } from './player/player-notification.service';
import { LocationNotificationService } from './notifications/location-notification.service';
import { PlayerItemService } from './player/player-item.service';
import { LootService } from './monster/loot.service';
import { GuildShopService } from '../modules/guild-shop/guild-shop.service';
import { GuildShopRepository } from '../modules/guild-shop/guild-shop.repository';
import { GuildShopPublisher } from '../modules/guild-shop/guild-shop.publisher';
import { GuildShopRotationService } from '../modules/guild-shop/guild-shop-rotation.service';
import { GuildShopRotationScheduler } from '../modules/guild-shop/guild-shop-rotation.scheduler';
import { GuildShopRotationInitializer } from '../modules/guild-shop/guild-shop-rotation.initializer';
import { GuildAnnouncementsService } from '../modules/guild-announcements/guild-announcements.service';
import { GuildAnnouncementsRepository } from '../modules/guild-announcements/guild-announcements.repository';
import { GuildAnnouncementsPublisher } from '../modules/guild-announcements/guild-announcements.publisher';
import { GuildAnnouncementsScheduler } from '../modules/guild-announcements/guild-announcements.scheduler';
import { FeedbackService } from '../modules/feedback/feedback.service';
import { FeedbackRepository } from '../modules/feedback/feedback.repository';
import { GitHubService } from '../modules/feedback/github.service';

@Module({
  imports: [AiModule],
  controllers: [
    AppController,
    PlayersController,
    MovementController,
    SystemController,
    ItemController,
    LocationController,
    LootController,
    GuildShopController,
    GuildAnnouncementsController,
    FeedbackController,
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
    DescriptionService,
    ResponseService,
    PopulationService,
    PrefetchService,
    PlayerNotificationService,
    LocationNotificationService,
    PlayerItemService,
    LootService,
    GuildShopService,
    GuildShopRepository,
    GuildShopPublisher,
    GuildShopRotationService,
    GuildShopRotationScheduler,
    GuildShopRotationInitializer,
    GuildAnnouncementsService,
    GuildAnnouncementsRepository,
    GuildAnnouncementsPublisher,
    GuildAnnouncementsScheduler,
    FeedbackService,
    FeedbackRepository,
    GitHubService,
  ],
})
export class AppModule {}
