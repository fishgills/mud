import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  HealthController,
  PlayerController,
  GameStateController,
  LocationController,
  AdminController,
} from './dm/controllers';
import { PlayerService } from './player/player.service';
import { MonsterService } from './monster/monster.service';
import { CombatService } from './combat/combat.service';
import { GameTickService } from './game-tick/game-tick.service';
import { WorldService } from './world/world.service';
import { OpenaiModule } from '../openai/openai.module';

@Module({
  imports: [OpenaiModule],
  controllers: [
    AppController,
    HealthController,
    PlayerController,
    GameStateController,
    LocationController,
    AdminController,
  ],
  providers: [
    AppService,
    PlayerService,
    MonsterService,
    CombatService,
    GameTickService,
    WorldService,
  ],
})
export class AppModule {}
