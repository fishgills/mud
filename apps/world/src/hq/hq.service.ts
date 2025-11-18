import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SpawnSelectorService } from './spawn-selector.service';
import { HQ_COORDINATE } from './hq.constants';

export type HqExitMode = 'return' | 'random';

export interface HqTransition {
  playerId: number;
  isInHq: boolean;
  location: { x: number; y: number };
  lastWorldPosition?: { x: number | null; y: number | null };
  mode?: HqExitMode;
}

@Injectable()
export class HqService {
  private readonly logger = new Logger(HqService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly spawnSelector: SpawnSelectorService,
  ) {}

  async enter(playerId: number): Promise<HqTransition> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!player) {
      throw new NotFoundException(`Player ${playerId} not found`);
    }

    if (player.isInHq) {
      return {
        playerId,
        isInHq: true,
        location: { x: player.x, y: player.y },
        lastWorldPosition: {
          x: player.lastWorldX ?? player.x,
          y: player.lastWorldY ?? player.y,
        },
      };
    }

    const lastWorldPosition = {
      x: player.lastWorldX ?? player.x,
      y: player.lastWorldY ?? player.y,
    };

    const updated = await this.prisma.player.update({
      where: { id: player.id },
      data: {
        isInHq: true,
        lastWorldX: lastWorldPosition.x,
        lastWorldY: lastWorldPosition.y,
        lastHqEnterAt: new Date(),
        x: HQ_COORDINATE.x,
        y: HQ_COORDINATE.y,
      },
    });

    this.logger.log(
      `Player ${playerId} entered HQ from (${lastWorldPosition.x}, ${lastWorldPosition.y})`,
    );

    return {
      playerId,
      isInHq: updated.isInHq,
      location: { x: updated.x, y: updated.y },
      lastWorldPosition,
    };
  }

  async exit(
    playerId: number,
    requestedMode: HqExitMode,
  ): Promise<HqTransition> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!player) {
      throw new NotFoundException(`Player ${playerId} not found`);
    }

    if (!player.isInHq) {
      throw new BadRequestException('Player is not currently inside HQ');
    }

    const canReturn =
      typeof player.lastWorldX === 'number' &&
      typeof player.lastWorldY === 'number';

    let mode: HqExitMode = requestedMode;
    let destination: { x: number; y: number };

    if (mode === 'return' && canReturn) {
      destination = {
        x: player.lastWorldX as number,
        y: player.lastWorldY as number,
      };
    } else {
      const preferred =
        mode === 'return' && canReturn
          ? { x: player.lastWorldX as number, y: player.lastWorldY as number }
          : null;
      const spawn = await this.spawnSelector.findSafeSpawn(playerId, preferred);
      destination = { x: spawn.x, y: spawn.y };
      mode = 'random';
    }

    const updated = await this.prisma.player.update({
      where: { id: player.id },
      data: {
        isInHq: false,
        x: destination.x,
        y: destination.y,
        lastWorldX: destination.x,
        lastWorldY: destination.y,
      },
    });

    this.logger.log(
      `Player ${playerId} exited HQ via ${mode} to (${destination.x}, ${destination.y})`,
    );

    return {
      playerId,
      isInHq: updated.isInHq,
      location: destination,
      lastWorldPosition: {
        x: destination.x,
        y: destination.y,
      },
      mode,
    };
  }

  async getStatus(playerId: number): Promise<HqTransition> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!player) {
      throw new NotFoundException(`Player ${playerId} not found`);
    }

    return {
      playerId,
      isInHq: player.isInHq,
      location: { x: player.x, y: player.y },
      lastWorldPosition: {
        x: player.lastWorldX ?? null,
        y: player.lastWorldY ?? null,
      },
    };
  }
}
