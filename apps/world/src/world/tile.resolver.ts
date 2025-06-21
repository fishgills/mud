import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { WorldTile } from './models/world-tile.model';
import { TileWithNearbyBiomes } from './models/tile-with-nearby-biomes.model';
import { TileUpdateResult } from './models/tile-update-result.model';
import { WorldService } from './world-refactored.service';

@Resolver(() => WorldTile)
export class TileResolver {
  constructor(private readonly worldService: WorldService) {}

  @Query(() => TileWithNearbyBiomes)
  async getTile(
    @Args('x', { type: () => Int }) x: number,
    @Args('y', { type: () => Int }) y: number,
  ): Promise<TileWithNearbyBiomes> {
    return this.worldService.getTileWithNearbyBiomes(x, y);
  }

  @Mutation(() => TileUpdateResult)
  async updateTileDescription(
    @Args('x', { type: () => Int }) x: number,
    @Args('y', { type: () => Int }) y: number,
    @Args('description') description: string,
  ): Promise<TileUpdateResult> {
    const updated = await this.worldService.updateTileDescription(
      x,
      y,
      description,
    );

    if (updated === null) {
      return {
        success: false,
        message: 'Tile not found',
      };
    }

    return {
      success: true,
      message: 'Tile description updated successfully',
    };
  }
}
