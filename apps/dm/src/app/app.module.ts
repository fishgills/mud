import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerService } from './player/player.service';
import { MonsterService } from './monster/monster.service';
import { CombatService } from './combat/combat.service';
import { AiModule } from '../openai/ai.module';
import {
  PlayersController,
  SystemController,
  ItemController,
  CombatController,
} from './api/controllers';
import { GuildShopController } from '../modules/guild-shop/guild-shop.controller';
import { GuildAnnouncementsController } from '../modules/guild-announcements/guild-announcements.controller';
import { FeedbackController } from '../modules/feedback/feedback.controller';
import { GuildsController } from '../modules/guilds/guilds.controller';
import { RunsController } from '../modules/runs/runs.controller';
import { CoordinationService } from '../shared/coordination.service';
import { EventBridgeService } from '../shared/event-bridge.service';
import { PlayerNotificationService } from './player/player-notification.service';
import { PlayerItemService } from './player/player-item.service';
import { GuildShopService } from '../modules/guild-shop/guild-shop.service';
import { GuildShopRepository } from '../modules/guild-shop/guild-shop.repository';
import { GuildShopPublisher } from '../modules/guild-shop/guild-shop.publisher';
import { GuildShopRotationService } from '../modules/guild-shop/guild-shop-rotation.service';
import { GuildShopRotationInitializer } from '../modules/guild-shop/guild-shop-rotation.initializer';
import { GuildAnnouncementsService } from '../modules/guild-announcements/guild-announcements.service';
import { GuildAnnouncementsRepository } from '../modules/guild-announcements/guild-announcements.repository';
import { GuildAnnouncementsPublisher } from '../modules/guild-announcements/guild-announcements.publisher';
import { GuildAnnouncementsScheduler } from '../modules/guild-announcements/guild-announcements.scheduler';
import { FeedbackService } from '../modules/feedback/feedback.service';
import { FeedbackRepository } from '../modules/feedback/feedback.repository';
import { GitHubService } from '../modules/feedback/github.service';
import { GuildsService } from '../modules/guilds/guilds.service';
import { RunsService } from '../modules/runs/runs.service';

@Module({
  imports: [AiModule],
  controllers: [
    AppController,
    PlayersController,
    SystemController,
    ItemController,
    CombatController,
    GuildShopController,
    GuildAnnouncementsController,
    FeedbackController,
    GuildsController,
    RunsController,
  ],
  providers: [
    AppService,
    PlayerService,
    MonsterService,
    CombatService,
    CoordinationService,
    EventBridgeService,
    PlayerNotificationService,
    PlayerItemService,
    GuildShopService,
    GuildShopRepository,
    GuildShopPublisher,
    GuildShopRotationService,
    GuildShopRotationInitializer,
    GuildsService,
    RunsService,
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
