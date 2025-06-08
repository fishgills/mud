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

  // Helper method to calculate direction from center tile to surrounding tile
  private getDirectionFromCenter(
    centerX: number,
    centerY: number,
    tileX: number,
    tileY: number
  ): string {
    const dx = tileX - centerX;
    const dy = tileY - centerY;

    if (dx === 0 && dy === -1) return 'north';
    if (dx === 1 && dy === -1) return 'northeast';
    if (dx === 1 && dy === 0) return 'east';
    if (dx === 1 && dy === 1) return 'southeast';
    if (dx === 0 && dy === 1) return 'south';
    if (dx === -1 && dy === 1) return 'southwest';
    if (dx === -1 && dy === 0) return 'west';
    if (dx === -1 && dy === -1) return 'northwest';

    return 'unknown';
  }

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
      const nearbyPlayers = await this.playerService.getNearbyPlayers(
        player.x,
        player.y,
        slackId, // Exclude the current player
        Infinity, // Infinite search radius
        10 // Top 10 closest players
      );

      // Get surrounding tiles for better context in AI description
      const surroundingTiles = await this.worldService.getSurroundingTiles(
        player.x,
        player.y,
        1 // 1 tile radius around the player
      );

      const gptJson = {
        ...tileInfo,
        nearbyPlayers,
        monsters,
        surroundingTiles: surroundingTiles.map((tile) => ({
          x: tile.x,
          y: tile.y,
          biomeName: tile.biomeName,
          description: tile.description,
          direction: this.getDirectionFromCenter(
            player.x,
            player.y,
            tile.x,
            tile.y
          ),
        })),
      };

      // Only generate AI description if the current tile has no description
      let description = tileInfo.description;
      if (!tileInfo.description || tileInfo.description.trim() === '') {
        const text = await this.aiService.getText(
          `Below is json information about the player's current position in the world. ` +
            `if 'currentSettlement' exists, the player is INSIDE a settlement. The intensity property describes how dense the city is at this location on a scale of 0 to 1. ` +
            `The nearbyPlayers array contains the top 10 closest players with their distance and direction. Always give directions to nearby players but never include player names. ` +
            `The surroundingTiles array contains information about the 8 tiles immediately surrounding the player's current position, including their biome, description, and direction from the player. ` +
            `Use this information to create a cohesive description that considers the immediate surroundings and transitions between different areas. \n ${JSON.stringify(
              gptJson
            )}`
        );
        description = text.output_text;

        // Save the generated description back to the tile
        try {
          await this.worldService.updateTileDescription(
            player.x,
            player.y,
            description || ''
          );
        } catch (error) {
          // Log the error but don't fail the request
          console.warn(
            `Failed to save tile description for (${player.x}, ${player.y}):`,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }

      return {
        success: true,
        data: {
          player,
          location: tileInfo,
          monsters,
          nearbyPlayers,
          surroundingTiles,
          description,
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
