import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ChunkData, ChunkStats, BiomeCount } from './models';
import { WorldTile } from './models/world-tile.model';
import { Settlement } from './models/settlement.model';
import { WorldService } from './world-refactored.service';

@Resolver(() => ChunkData)
export class ChunkResolver {
  constructor(private readonly worldService: WorldService) {}

  @Query(() => ChunkData)
  async getChunk(
    @Args('chunkX') chunkX: number,
    @Args('chunkY') chunkY: number,
  ): Promise<ChunkData> {
    // Return basic chunk info - fields will be resolved on-demand
    return {
      chunkX,
      chunkY,
    };
  }

  @ResolveField(() => [WorldTile])
  async tiles(@Parent() chunk: ChunkData): Promise<WorldTile[]> {
    return this.worldService.getChunkTiles(chunk.chunkX, chunk.chunkY);
  }

  @ResolveField(() => [Settlement])
  async settlements(@Parent() chunk: ChunkData): Promise<Settlement[]> {
    return this.worldService.getChunkSettlements(chunk.chunkX, chunk.chunkY);
  }

  @ResolveField(() => ChunkStats)
  async stats(@Parent() chunk: ChunkData): Promise<ChunkStats> {
    return this.worldService.getChunkStats(chunk.chunkX, chunk.chunkY);
  }

  @ResolveField(() => [BiomeCount])
  async biomeStats(@Parent() chunk: ChunkData): Promise<BiomeCount[]> {
    return this.worldService.getChunkBiomeStats(chunk.chunkX, chunk.chunkY);
  }
}
