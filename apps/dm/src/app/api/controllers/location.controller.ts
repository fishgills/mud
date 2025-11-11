import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import type {
  Player,
  Prisma,
  Monster,
  WorldItemWithDetails,
} from '@mud/database';
import { PlayerService } from '../../player/player.service';
import { MonsterService } from '../../monster/monster.service';
import { PlayerItemService } from '../../player/player-item.service';

interface LocationCollectionResponse<T> {
  success: boolean;
  data: T[];
}

type PlayerWithSlack = Player & Prisma.SlackUserInclude;

@Controller('location')
export class LocationController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly monsterService: MonsterService,
    private readonly playerItemService: PlayerItemService,
  ) {}

  @Get('players')
  async getPlayersAtLocation(
    @Query('x') rawX?: string,
    @Query('y') rawY?: string,
  ): Promise<LocationCollectionResponse<PlayerWithSlack>> {
    const { x, y } = this.parseCoordinates(rawX, rawY);
    const players = await this.playerService.getPlayersAtLocation(x, y);
    return { success: true, data: players };
  }

  @Get('monsters')
  async getMonstersAtLocation(
    @Query('x') rawX?: string,
    @Query('y') rawY?: string,
  ): Promise<LocationCollectionResponse<Monster>> {
    const { x, y } = this.parseCoordinates(rawX, rawY);
    const monsters = await this.monsterService.getMonstersAtLocation(x, y);
    return { success: true, data: monsters };
  }

  @Get('items')
  async getItemsAtLocation(
    @Query('x') rawX?: string,
    @Query('y') rawY?: string,
  ): Promise<LocationCollectionResponse<WorldItemWithDetails>> {
    const { x, y } = this.parseCoordinates(rawX, rawY);
    const records = await this.playerItemService.listWorldItemsAtLocation(x, y);
    const items = records.map((item) => this.serializeWorldItem(item));
    return { success: true, data: items };
  }

  private serializeWorldItem(
    item: WorldItemWithDetails,
  ): WorldItemWithDetails & {
    itemName?: string | null;
    allowedSlots?: string[];
  } {
    const allowedSlots: string[] = [];
    const slot = (item.item as { slot?: string | null } | null)?.slot;
    if (slot) {
      allowedSlots.push(slot);
    } else if (
      (item.item as { type?: string } | null)?.type?.toLowerCase() === 'weapon'
    ) {
      allowedSlots.push('weapon');
    }

    return {
      ...item,
      itemName: (item.item as { name?: string } | null)?.name ?? null,
      allowedSlots,
    };
  }

  private parseCoordinates(rawX?: string, rawY?: string): { x: number; y: number } {
    if (rawX === undefined || rawY === undefined) {
      throw new BadRequestException('x and y query parameters are required');
    }
    const x = Number.parseInt(rawX, 10);
    const y = Number.parseInt(rawY, 10);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      throw new BadRequestException('x and y must be numbers');
    }
    return { x, y };
  }
}
