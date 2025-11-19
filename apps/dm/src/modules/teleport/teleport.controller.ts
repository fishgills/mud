import { Body, Controller, Post } from '@nestjs/common';
import { TeleportService } from './teleport.service';
import type {
  GuildTeleportRequest,
  GuildTeleportResponse,
} from '@mud/api-contracts';

@Controller('guild')
export class TeleportController {
  constructor(private readonly teleportService: TeleportService) {}

  @Post('teleport')
  async teleport(
    @Body() body: GuildTeleportRequest,
  ): Promise<GuildTeleportResponse> {
    return this.teleportService.teleport({
      teamId: body.teamId,
      userId: body.userId,
      correlationId: body.correlationId,
    });
  }
}
