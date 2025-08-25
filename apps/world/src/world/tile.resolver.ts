import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { WorldTile } from './models/world-tile.model';
import { TileWithNearbyBiomes } from './models/tile-with-nearby-biomes.model';
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
}
