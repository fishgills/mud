import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RunsService } from './runs.service';
import { RunStatus, RunType } from '@mud/database';
import type { RunActionResponse, RunState } from './runs.dto';

const toRunState = (run: {
  id: number;
  runType: RunType;
  status: RunStatus;
  round: number;
  bankedXp: number;
  bankedGold: number;
  difficultyTier: number;
  leaderPlayerId: number;
  guildId?: number | null;
}): RunState => ({
  id: run.id,
  runType: run.runType,
  status: run.status,
  round: run.round,
  bankedXp: run.bankedXp,
  bankedGold: run.bankedGold,
  difficultyTier: run.difficultyTier,
  leaderPlayerId: run.leaderPlayerId,
  guildId: run.guildId ?? null,
});

const parseRunType = (value?: string) =>
  value && value.toLowerCase() === 'guild' ? RunType.GUILD : RunType.SOLO;

@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Get('active')
  async active(
    @Query('teamId') teamId: string,
    @Query('userId') userId: string,
  ): Promise<RunActionResponse> {
    if (!teamId || !userId) {
      return { success: false, message: 'teamId and userId are required' };
    }

    const active = await this.runsService.getActiveRunForTeamUser(
      teamId,
      userId,
    );
    if (!active) {
      return { success: true, data: undefined };
    }

    return { success: true, data: toRunState(active) };
  }

  @Post('start')
  async start(
    @Body()
    body: { teamId?: string; userId?: string; type?: string },
  ): Promise<RunActionResponse> {
    const teamId = body.teamId;
    const userId = body.userId;
    if (!teamId || !userId) {
      return { success: false, message: 'teamId and userId are required' };
    }

    try {
      const run = await this.runsService.startRun(
        teamId,
        userId,
        parseRunType(body.type),
      );
      const latest = await this.runsService.getRunById(run.id);
      return {
        success: true,
        data: latest ? toRunState(latest) : toRunState(run),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start raid',
      };
    }
  }

  @Post('continue')
  async continueRun(
    @Body()
    body: { teamId?: string; userId?: string; runId?: number },
  ): Promise<RunActionResponse> {
    const teamId = body.teamId;
    const userId = body.userId;
    if (!teamId || !userId) {
      return { success: false, message: 'teamId and userId are required' };
    }

    try {
      const run = await this.runsService.continueRun(
        teamId,
        userId,
        body.runId,
      );
      const latest = await this.runsService.getRunById(run.id);
      return {
        success: true,
        data: latest ? toRunState(latest) : toRunState(run),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to continue raid',
      };
    }
  }

  @Post('finish')
  async finish(
    @Body()
    body: { teamId?: string; userId?: string; runId?: number },
  ): Promise<RunActionResponse> {
    const teamId = body.teamId;
    const userId = body.userId;
    if (!teamId || !userId) {
      return { success: false, message: 'teamId and userId are required' };
    }

    try {
      const run = await this.runsService.finishRun(
        teamId,
        userId,
        body.runId,
      );
      return {
        success: true,
        data: toRunState(run),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to finish raid',
      };
    }
  }
}
