import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DmController } from './dm/dm.controller';
import { PlayerService } from './player/player.service';
import { MonsterService } from './monster/monster.service';
import { CombatService } from './combat/combat.service';
import { GameTickService } from './game-tick/game-tick.service';
import { WorldService } from './world/world.service';

@Module({
  imports: [],
  controllers: [AppController, DmController],
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
