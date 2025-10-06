import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { WorldTile } from './models/world-tile.model';
import { WorldService } from './world-refactored.service';

@Resolver(() => WorldTile)
export class BoundsResolver {
  constructor(private readonly worldService: WorldService) {}

  @Query(() => [WorldTile])
  async getTilesInBounds(
    @Args('minX', { type: () => Int }) minX: number,
    @Args('maxX', { type: () => Int }) maxX: number,
    @Args('minY', { type: () => Int }) minY: number,
    @Args('maxY', { type: () => Int }) maxY: number,
  ): Promise<WorldTile[]> {
    return this.worldService.getTilesInBounds(minX, maxX, minY, maxY);
  }
}
