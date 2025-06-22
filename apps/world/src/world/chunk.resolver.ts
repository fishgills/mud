import {
  Args,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Int,
} from '@nestjs/graphql';
import { ChunkData, ChunkStats, BiomeCount, PaginatedTiles } from './models';
import { WorldTile } from './models/world-tile.model';
import { Settlement } from './models/settlement.model';
import { WorldService } from './world-refactored.service';

@Resolver(() => ChunkData)
export class ChunkResolver {
  constructor(private readonly worldService: WorldService) {}

  @Query(() => ChunkData)
  getChunk(
    @Args('chunkX') chunkX: number,
    @Args('chunkY') chunkY: number,
  ): ChunkData {
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

  @ResolveField(() => PaginatedTiles)
  async paginatedTiles(
    @Parent() chunk: ChunkData,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<PaginatedTiles> {
    // Set defaults
    const actualLimit = limit ?? 100;
    const actualOffset = offset ?? 0;

    // Get tiles and total count
    const [tiles, totalCount] = await Promise.all([
      this.worldService.getChunkTiles(
        chunk.chunkX,
        chunk.chunkY,
        actualLimit,
        actualOffset,
      ),
      this.worldService.getChunkTileCount(chunk.chunkX, chunk.chunkY),
    ]);

    return {
      tiles,
      totalCount,
      offset: actualOffset,
      limit: actualLimit,
      hasMore: actualOffset + actualLimit < totalCount,
    };
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
