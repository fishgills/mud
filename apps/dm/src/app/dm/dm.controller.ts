import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PlayerService } from '../player/player.service';
import { MonsterService } from '../monster/monster.service';
import { CombatService } from '../combat/combat.service';
import { GameTickService } from '../game-tick/game-tick.service';
import { WorldService } from '../world/world.service';
import type {
  CreatePlayerDto,
  MovePlayerDto,
  AttackDto,
} from '../player/dto/player.dto';
import { OpenaiService } from '../../openai/openai.service';

@Controller('dm')
export class DmController {
  private readonly logger = new Logger(DmController.name);

  constructor(
    private playerService: PlayerService,
    private monsterService: MonsterService,
    private combatService: CombatService,
    private gameTickService: GameTickService,
    private worldService: WorldService,
    private aiService: OpenaiService
  ) {}

  // Health check endpoint
  @Get('health')
  health() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  // Tick endpoint - called by the external tick service
  @Post('tick')
  async processTick() {
    try {
      const result = await this.gameTickService.processTick();
      return {
        success: true,
        data: result,
      };
    } catch {
      throw new HttpException(
        'Failed to process tick',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Player management endpoints
  @Post('player')
  async createPlayer(@Body() createPlayerDto: CreatePlayerDto) {
    try {
      const player = await this.playerService.createPlayer(createPlayerDto);
      return {
        success: true,
        data: player,
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to create player',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('player/:slackId')
  async getPlayer(@Param('slackId') slackId: string) {
    try {
      const player = await this.playerService.getPlayer(slackId);

      // Get world tile information
      const tileInfo = await this.worldService.getTileInfo(player.x, player.y);

      // Get monsters at the same location
      const monsters = await this.monsterService.getMonstersAtLocation(
        player.x,
        player.y
      );

      // Get other players at the same location
      const otherPlayers = await this.playerService.getPlayersAtLocation(
        player.x,
        player.y
      );
      const filteredPlayers = otherPlayers.filter((p) => p.slackId !== slackId);

      return {
        success: true,
        data: {
          player,
          location: tileInfo,
          monsters,
          otherPlayers: filteredPlayers,
        },
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Player not found',
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Post('player/:slackId/move')
  async movePlayer(
    @Param('slackId') slackId: string,
    @Body() moveDto: MovePlayerDto
  ) {
    try {
      const player = await this.playerService.movePlayer(slackId, moveDto);

      // Get new location info
      const tileInfo = await this.worldService.getTileInfo(player.x, player.y);
      const monsters = await this.monsterService.getMonstersAtLocation(
        player.x,
        player.y
      );

      const text = await this.aiService.getText(JSON.stringify(tileInfo));
      this.logger.debug(`AI response: ${text}`);
      return {
        success: true,
        data: {
          player,
          location: tileInfo,
          monsters,
        },
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to move player',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('player/:slackId/attack')
  async playerAttack(
    @Param('slackId') slackId: string,
    @Body() attackDto: AttackDto
  ) {
    try {
      let result;

      if (attackDto.targetType === 'monster') {
        result = await this.combatService.playerAttackMonster(
          slackId,
          attackDto.targetId
        );
      } else if (attackDto.targetType === 'player') {
        // For player vs player, we need to find the target player by ID
        // This is a simplification - in a real system you might want to use slackId
        const allPlayers = await this.playerService.getAllPlayers();
        const targetPlayer = allPlayers.find(
          (p) => p.id === attackDto.targetId
        );

        if (!targetPlayer) {
          throw new Error('Target player not found');
        }

        result = await this.combatService.playerAttackPlayer(
          slackId,
          targetPlayer.slackId
        );
      } else {
        throw new Error('Invalid target type');
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Attack failed',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('player/:slackId/respawn')
  async respawnPlayer(@Param('slackId') slackId: string) {
    try {
      const player = await this.playerService.respawnPlayer(slackId);
      return {
        success: true,
        data: player,
        message: 'You have been resurrected at the starting location!',
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to respawn player',
        HttpStatus.BAD_REQUEST
      );
    }
  }

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

  @Get('location/:x/:y')
  async getLocationInfo(@Param('x') x: string, @Param('y') y: string) {
    try {
      const xCoord = parseInt(x);
      const yCoord = parseInt(y);

      const tileInfo = await this.worldService.getTileInfo(xCoord, yCoord);
      const monsters = await this.monsterService.getMonstersAtLocation(
        xCoord,
        yCoord
      );
      const players = await this.playerService.getPlayersAtLocation(
        xCoord,
        yCoord
      );
      const combatLog = await this.combatService.getCombatLogForLocation(
        xCoord,
        yCoord
      );

      return {
        success: true,
        data: {
          location: tileInfo,
          monsters,
          players,
          recentCombat: combatLog,
        },
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to get location info',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // Admin endpoints
  @Post('admin/spawn-monster/:x/:y')
  async spawnMonster(@Param('x') x: string, @Param('y') y: string) {
    try {
      const xCoord = parseInt(x);
      const yCoord = parseInt(y);

      // Get biome info from world service
      const tileInfo = await this.worldService.getTileInfo(xCoord, yCoord);
      const monster = await this.monsterService.spawnMonster(
        xCoord,
        yCoord,
        tileInfo.biomeId
      );

      return {
        success: true,
        data: monster,
        message: `Spawned ${monster.name} at (${xCoord}, ${yCoord})`,
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to spawn monster',
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
