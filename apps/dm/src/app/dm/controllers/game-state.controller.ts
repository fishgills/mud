import { Controller, Get } from '@nestjs/common';
import { PlayerService } from '../../player/player.service';
import { MonsterService } from '../../monster/monster.service';
import { GameTickService } from '../../game-tick/game-tick.service';

@Controller('dm')
export class GameStateController {
  constructor(
    private playerService: PlayerService,
    private monsterService: MonsterService,
    private gameTickService: GameTickService,
  ) {}

  // Game state endpoints
  @Get('game-state')
  async getGameState() {
    const state = await this.gameTickService.getGameState();
    return {
      success: true,
      data: state,
    };
  }

  @Get('players')
  async getAllPlayers() {
    const players = await this.playerService.getAllPlayers();
    return {
      success: true,
      data: players,
    };
  }

  @Get('monsters')
  async getAllMonsters() {
    const monsters = await this.monsterService.getAllMonsters();
    return {
      success: true,
      data: monsters,
    };
  }
}
