import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PlayerService } from '../../app/player/player.service';
import { CombatService } from '../../app/combat/combat.service';
import { TeleportRepository } from './teleport.repository';
import { TeleportPublisher } from './teleport.publisher';
import type {
  GuildTeleportResponse,
  GuildServicesStatus,
} from '@mud/api-contracts';
import { withGuildLogFields } from '@mud/logging';
import { recordGuildTeleportMetric } from './teleport.metrics';

const DEFAULT_GUILD_SERVICES: GuildServicesStatus = {
  shop: true,
  crier: true,
  exits: ['return'],
};

const normalizeGuildServices = (value: unknown): GuildServicesStatus => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return {
      shop:
        typeof record.shop === 'boolean'
          ? record.shop
          : DEFAULT_GUILD_SERVICES.shop,
      crier:
        typeof record.crier === 'boolean'
          ? record.crier
          : DEFAULT_GUILD_SERVICES.crier,
      exits: Array.isArray(record.exits)
        ? record.exits.map((exit) => String(exit))
        : [...DEFAULT_GUILD_SERVICES.exits],
    };
  }

  return { ...DEFAULT_GUILD_SERVICES };
};

export interface TeleportRequest {
  teamId: string;
  userId: string;
  correlationId?: string;
}

@Injectable()
export class TeleportService {
  private readonly logger = new Logger(TeleportService.name);

  constructor(
    private readonly playerService: PlayerService,
    private readonly combatService: CombatService,
    private readonly repository: TeleportRepository,
    private readonly publisher: TeleportPublisher,
  ) {}

  async teleport(request: TeleportRequest): Promise<GuildTeleportResponse> {
    const startedAt = Date.now();
    const player = await this.playerService.getPlayer(
      request.teamId,
      request.userId,
    );

    if (!player?.isAlive) {
      throw new BadRequestException('You cannot teleport while incapacitated.');
    }

    const inCombat = await this.combatService.isPlayerInCombat(player.id);
    if (inCombat) {
      throw new ConflictException(
        'Finish the ongoing combat before using guild teleport.',
      );
    }

    const guild = await this.repository.getGuildHall();
    if (!guild) {
      throw new ServiceUnavailableException('Guild Hall is not configured.');
    }

    const state = await this.repository.getPlayerState(player.id);
    const now = new Date();
    if (state?.cooldownExpiresAt && state.cooldownExpiresAt > now) {
      const secondsLeft = Math.ceil(
        (state.cooldownExpiresAt.getTime() - now.getTime()) / 1000,
      );
      throw new BadRequestException(
        `Guild teleport will be ready in ${secondsLeft}s.`,
      );
    }

    const moveResult = await this.repository.movePlayerToGuild(player, guild);
    const cooldownExpiresAt = new Date(
      now.getTime() + guild.teleportCooldownSeconds * 1000,
    );

    await this.repository.upsertPlayerState(player.id, {
      lastTeleportAt: now,
      cooldownExpiresAt,
    });

    const services = normalizeGuildServices(guild.services);

    const response: GuildTeleportResponse = {
      success: true,
      playerId: moveResult.updatedPlayer.id.toString(),
      guildTileId: guild.slug,
      arrivalMessage: guild.arrivalMessage,
      services,
      occupantsNotified: moveResult.occupants.map((id) => id.toString()),
      correlationId:
        request.correlationId ??
        `guild-${moveResult.updatedPlayer.id}-${now.getTime()}`,
    };

    await this.publisher.emitTeleport(response);
    recordGuildTeleportMetric(
      {
        playerId: moveResult.updatedPlayer.id,
        command: 'guild',
        correlationId: response.correlationId,
      },
      Date.now() - startedAt,
    );
    this.logger.log(
      withGuildLogFields(
        { message: 'Player teleported to guild hall' },
        {
          playerId: moveResult.updatedPlayer.id,
          correlationId: response.correlationId,
          command: 'guild',
        },
      ),
    );

    return response;
  }
}
