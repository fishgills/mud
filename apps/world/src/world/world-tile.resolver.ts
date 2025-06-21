import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { WorldTile } from './models/world-tile.model';
import { Biome } from './models/biome.model';
import { Monster } from './models/monster.model';
import { Player } from './models/player.model';
import { WorldDatabaseService } from './world-database.service';

@Resolver(() => WorldTile)
export class WorldTileResolver {
  constructor(private readonly worldDatabase: WorldDatabaseService) {}

  @ResolveField(() => Biome)
  async biome(@Parent() tile: WorldTile): Promise<Biome> {
    // Get biome by biomeId
    const biome = await this.worldDatabase.getBiomeById(tile.biomeId);
    if (!biome) {
      throw new Error(`Biome with id ${tile.biomeId} not found`);
    }
    return biome;
  }

  @ResolveField(() => [Monster])
  async monsters(@Parent() tile: WorldTile): Promise<Monster[]> {
    // Get monsters at this tile location
    return this.worldDatabase.getMonstersAtTile(tile.x, tile.y);
  }

  @ResolveField(() => [Player])
  async players(@Parent() tile: WorldTile): Promise<Player[]> {
    // Get players at this tile location
    return this.worldDatabase.getPlayersAtTile(tile.x, tile.y);
  }
}
