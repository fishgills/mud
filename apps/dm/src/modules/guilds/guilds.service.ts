import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { getPrismaClient, type Guild, type PlayerWithSlackUser } from '@mud/database';
import { PlayerService } from '../../app/player/player.service';

@Injectable()
export class GuildsService {
  private prisma = getPrismaClient();
  private readonly logger = new Logger(GuildsService.name);

  constructor(private readonly playerService: PlayerService) {}

  async getGuildInfo(teamId: string, userId: string) {
    const player = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });

    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId: player.id },
      include: {
        guild: true,
      },
    });

    if (!membership) {
      return null;
    }

    const members = await this.prisma.guildMember.findMany({
      where: { guildId: membership.guildId },
      include: {
        player: {
          include: {
            slackUser: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      guild: membership.guild,
      members: members.map((member) => ({
        playerId: member.playerId,
        name: member.player.name,
        userId: member.player.slackUser?.userId ?? undefined,
        isLeader: member.isLeader,
        joinedAt: member.joinedAt,
      })),
    };
  }

  async listInvites(teamId: string, userId: string) {
    const player = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });

    const invites = await this.prisma.guildInvite.findMany({
      where: { inviteePlayerId: player.id },
      include: {
        guild: true,
        inviter: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((invite) => ({
      guildId: invite.guildId,
      guildName: invite.guild.name,
      inviterName: invite.inviter.name,
      createdAt: invite.createdAt,
    }));
  }

  async createGuild(teamId: string, userId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Guild name is required.');
    }

    const player = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });

    const existingMembership = await this.prisma.guildMember.findUnique({
      where: { playerId: player.id },
    });
    if (existingMembership) {
      throw new BadRequestException('You are already in a guild.');
    }

    const existingGuild = await this.prisma.guild.findFirst({
      where: {
        teamId,
        name: trimmed,
      },
    });
    if (existingGuild) {
      throw new BadRequestException('A guild with that name already exists.');
    }

    const guild = await this.prisma.guild.create({
      data: {
        teamId,
        name: trimmed,
      },
    });

    await this.prisma.guildMember.create({
      data: {
        guildId: guild.id,
        playerId: player.id,
        isLeader: true,
      },
    });

    this.logger.log(`Created guild ${guild.name} for team ${teamId}`);

    return guild;
  }

  async inviteMember(
    teamId: string,
    userId: string,
    targetUserId: string,
  ) {
    if (!targetUserId) {
      throw new BadRequestException('Select a player to invite.');
    }

    const inviter = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });
    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId: inviter.id },
      include: { guild: true },
    });

    if (!membership) {
      throw new BadRequestException('You are not in a guild.');
    }

    if (!membership.isLeader) {
      throw new BadRequestException('Only guild leaders can invite members.');
    }

    if (targetUserId === userId) {
      throw new BadRequestException('You cannot invite yourself.');
    }

    const invitee = await this.playerService
      .getPlayer(teamId, targetUserId, { requireCreationComplete: true })
      .catch(() => null);

    if (!invitee) {
      throw new NotFoundException('That player does not have a character yet.');
    }

    const existingMember = await this.prisma.guildMember.findUnique({
      where: { playerId: invitee.id },
    });
    if (existingMember) {
      throw new BadRequestException('That player is already in a guild.');
    }

    const existingInvite = await this.prisma.guildInvite.findUnique({
      where: {
        guildId_inviteePlayerId: {
          guildId: membership.guildId,
          inviteePlayerId: invitee.id,
        },
      },
    });

    if (existingInvite) {
      throw new BadRequestException('That player already has an invite.');
    }

    await this.prisma.guildInvite.create({
      data: {
        guildId: membership.guildId,
        inviterPlayerId: inviter.id,
        inviteePlayerId: invitee.id,
      },
    });

    return {
      guild: membership.guild,
      invitee: invitee as PlayerWithSlackUser,
    };
  }

  async joinGuild(teamId: string, userId: string, guildName?: string) {
    const player = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });

    const existingMembership = await this.prisma.guildMember.findUnique({
      where: { playerId: player.id },
    });
    if (existingMembership) {
      throw new BadRequestException('You are already in a guild.');
    }

    let guild: Guild | null = null;

    if (guildName) {
      guild = await this.prisma.guild.findFirst({
        where: { teamId, name: guildName.trim() },
      });
      if (!guild) {
        throw new NotFoundException('No guild found with that name.');
      }
    }

    const invite = await this.prisma.guildInvite.findFirst({
      where: {
        inviteePlayerId: player.id,
        ...(guild ? { guildId: guild.id } : {}),
      },
      include: { guild: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!invite) {
      throw new BadRequestException(
        guild
          ? 'You do not have an invite to that guild.'
          : 'You do not have any guild invites.',
      );
    }

    const finalGuild = invite.guild;

    await this.prisma.$transaction([
      this.prisma.guildMember.create({
        data: {
          guildId: finalGuild.id,
          playerId: player.id,
          isLeader: false,
        },
      }),
      this.prisma.guildInvite.delete({ where: { id: invite.id } }),
    ]);

    return finalGuild;
  }

  async leaveGuild(teamId: string, userId: string) {
    const player = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });

    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId: player.id },
    });

    if (!membership) {
      throw new BadRequestException('You are not in a guild.');
    }

    const members = await this.prisma.guildMember.findMany({
      where: { guildId: membership.guildId },
      orderBy: { joinedAt: 'asc' },
    });

    await this.prisma.guildMember.delete({
      where: { id: membership.id },
    });

    const remaining = members.filter((member) => member.id !== membership.id);

    if (remaining.length === 0) {
      await this.prisma.guild.delete({ where: { id: membership.guildId } });
      return { deleted: true };
    }

    if (membership.isLeader) {
      const successor = remaining[0];
      await this.prisma.guildMember.update({
        where: { id: successor.id },
        data: { isLeader: true },
      });
    }

    return { deleted: false };
  }

  async getGuildWithMembers(playerId: number) {
    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true },
    });

    if (!membership) {
      return null;
    }

    const members = await this.prisma.guildMember.findMany({
      where: { guildId: membership.guildId },
      include: {
        player: {
          include: {
            slackUser: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      guild: membership.guild,
      members,
      leaderId: members.find((member) => member.isLeader)?.playerId ?? null,
    };
  }
}
