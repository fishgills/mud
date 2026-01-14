import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GuildsService } from './guilds.service';
import type { GuildInfoResponse, GuildInvitesResponse } from './guilds.dto';
import type { SuccessResponse } from '../../app/api/dto/responses.dto';

@Controller('guilds')
export class GuildsController {
  constructor(private readonly guildsService: GuildsService) {}

  @Get('info')
  async info(
    @Query('teamId') teamId: string,
    @Query('userId') userId: string,
  ): Promise<GuildInfoResponse> {
    if (!teamId || !userId) {
      return { success: false, message: 'teamId and userId are required' };
    }

    const result = await this.guildsService.getGuildInfo(teamId, userId);
    if (!result) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        guildId: result.guild.id,
        name: result.guild.name,
        teamId: result.guild.teamId,
        members: result.members,
      },
    };
  }

  @Get('invites')
  async invites(
    @Query('teamId') teamId: string,
    @Query('userId') userId: string,
  ): Promise<GuildInvitesResponse> {
    if (!teamId || !userId) {
      return { success: false, message: 'teamId and userId are required' };
    }

    const invites = await this.guildsService.listInvites(teamId, userId);
    return { success: true, data: invites };
  }

  @Post('create')
  async create(
    @Body() body: { teamId: string; userId: string; name?: string },
  ): Promise<SuccessResponse> {
    const name = body.name ?? '';
    await this.guildsService.createGuild(body.teamId, body.userId, name);
    return { success: true, message: `Guild created: ${name.trim()}` };
  }

  @Post('invite')
  async invite(
    @Body()
    body: { teamId: string; userId: string; targetUserId?: string },
  ): Promise<SuccessResponse> {
    const result = await this.guildsService.inviteMember(
      body.teamId,
      body.userId,
      body.targetUserId ?? '',
    );
    return {
      success: true,
      message: `Invited ${result.invitee.name} to ${result.guild.name}.`,
    };
  }

  @Post('join')
  async join(
    @Body() body: { teamId: string; userId: string; guildName?: string },
  ): Promise<SuccessResponse> {
    const guild = await this.guildsService.joinGuild(
      body.teamId,
      body.userId,
      body.guildName,
    );
    return { success: true, message: `Joined guild ${guild.name}.` };
  }

  @Post('leave')
  async leave(
    @Body() body: { teamId: string; userId: string },
  ): Promise<SuccessResponse> {
    const result = await this.guildsService.leaveGuild(
      body.teamId,
      body.userId,
    );
    return {
      success: true,
      message: result.deleted
        ? 'You left and disbanded the guild.'
        : 'You left the guild.',
    };
  }
}
