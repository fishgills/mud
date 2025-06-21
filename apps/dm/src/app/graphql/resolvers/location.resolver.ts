import {
  Resolver,
  Query,
  Args,
  Int,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { PlayerService } from '../../player/player.service';
import { MonsterService } from '../../monster/monster.service';
import { CombatService } from '../../combat/combat.service';
import { WorldService } from '../../world/world.service';
import { LocationInfo, LocationResponse } from '../types/response.types';
import { TileInfo } from '../models/tile-info.model';
import { Player } from '../models/player.model';
import { Monster } from '../models/monster.model';
import { CombatLog } from '../models/combat-log.model';

@Resolver(() => LocationInfo)
export class LocationResolver {
  constructor(
    private playerService: PlayerService,
    private monsterService: MonsterService,
    private combatService: CombatService,
    private worldService: WorldService,
  ) {}

  @Query(() => LocationResponse)
  async getLocationInfo(
    @Args('x', { type: () => Int }) x: number,
    @Args('y', { type: () => Int }) y: number,
  ): Promise<LocationResponse> {
    try {
      const tileInfo = await this.worldService.getTileInfo(x, y);

      // Map tileInfo to our simplified TileInfo type
      const location: TileInfo = {
        x: tileInfo.x,
        y: tileInfo.y,
        biomeName: tileInfo.biomeName,
        description: tileInfo.description,
        height: tileInfo.height,
        temperature: tileInfo.temperature,
        moisture: tileInfo.moisture,
      };

      // Create LocationInfo with coordinates for field resolvers
      const locationInfo: LocationInfo = {
        location,
        x, // Store for field resolvers
        y, // Store for field resolvers
      };

      return {
        success: true,
        data: locationInfo,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get location info',
      };
    }
  }

  // Field resolvers for on-demand data loading
  @ResolveField(() => [Monster], { nullable: true })
  async monsters(@Parent() locationInfo: LocationInfo): Promise<Monster[]> {
    try {
      return (await this.monsterService.getMonstersAtLocation(
        locationInfo.x,
        locationInfo.y,
      )) as Monster[];
    } catch (error) {
      return [];
    }
  }

  @ResolveField(() => [Player], { nullable: true })
  async players(@Parent() locationInfo: LocationInfo): Promise<Player[]> {
    try {
      return (await this.playerService.getPlayersAtLocation(
        locationInfo.x,
        locationInfo.y,
      )) as Player[];
    } catch (error) {
      return [];
    }
  }

  @ResolveField(() => [CombatLog], { nullable: true })
  async recentCombat(
    @Parent() locationInfo: LocationInfo,
  ): Promise<CombatLog[]> {
    try {
      return (await this.combatService.getCombatLogForLocation(
        locationInfo.x,
        locationInfo.y,
      )) as CombatLog[];
    } catch (error) {
      return [];
    }
  }
}
