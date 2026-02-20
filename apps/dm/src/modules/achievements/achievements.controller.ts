import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AchievementsService } from './achievements.service';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  async summary(
    @Query('teamId') teamId?: string,
    @Query('userId') userId?: string,
  ) {
    if (!teamId || !userId) {
      return { success: false, message: 'teamId and userId are required' };
    }

    try {
      const data = await this.achievementsService.getPlayerSummary(
        teamId,
        userId,
      );
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load achievement summary',
      };
    }
  }

  @Get('list')
  async list(
    @Query('teamId') teamId?: string,
    @Query('userId') userId?: string,
  ) {
    if (!teamId || !userId) {
      return { success: false, message: 'teamId and userId are required' };
    }

    try {
      const data = await this.achievementsService.getPlayerAchievementList(
        teamId,
        userId,
      );
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load achievements',
      };
    }
  }

  @Get('config')
  async config(@Query('teamId') teamId?: string) {
    if (!teamId) {
      return { success: false, message: 'teamId is required' };
    }

    try {
      const data = await this.achievementsService.getBroadcastConfig(teamId);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load achievement broadcast config',
      };
    }
  }

  @Post('config')
  async updateConfig(
    @Body()
    body: {
      teamId?: string;
      enabled?: boolean;
      channelId?: string | null;
      perPlayerCooldownSeconds?: number;
      globalCooldownSeconds?: number;
    },
  ) {
    if (!body.teamId) {
      return { success: false, message: 'teamId is required' };
    }

    try {
      const data = await this.achievementsService.updateBroadcastConfig({
        teamId: body.teamId,
        enabled: body.enabled,
        channelId: body.channelId,
        perPlayerCooldownSeconds: body.perPlayerCooldownSeconds,
        globalCooldownSeconds: body.globalCooldownSeconds,
      });
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update achievement broadcast config',
      };
    }
  }
}
