import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { TileService } from './world/tile.service';
import {
  GenerateTileRequest,
  GenerateTileResponse,
  WorldService,
} from './proto/world';
import * as common from './proto/common';

@Controller()
export class AppController implements WorldService {
  constructor(
    private readonly appService: AppService,
    private readonly tileService: TileService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @GrpcMethod('WorldService', 'GenerateTile')
  async GenerateTile(
    request: GenerateTileRequest,
  ): Promise<GenerateTileResponse> {
    const tile = await this.tileService.getTile(request.x, request.y);

    if (!tile) {
      throw new RpcException(`Tile not found at ${request.x},${request.y}`);
    }

    const responseTile: common.Tile = {
      description: tile.description ?? '',
      biome: tile.biomeName,
    };

    return {
      tile: responseTile,
    };
  }
}