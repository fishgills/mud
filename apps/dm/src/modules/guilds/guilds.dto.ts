import type { SuccessResponse } from '../../app/api/dto/responses.dto';

export interface GuildMemberInfo {
  playerId: number;
  name: string;
  userId?: string;
  isLeader: boolean;
  joinedAt: Date;
}

export interface GuildInfoResponse extends SuccessResponse {
  data?: {
    guildId: number;
    name: string;
    teamId: string;
    members: GuildMemberInfo[];
  } | null;
}

export interface GuildInviteInfo {
  guildId: number;
  guildName: string;
  inviterName: string;
  createdAt: Date;
}

export interface GuildInvitesResponse extends SuccessResponse {
  data?: GuildInviteInfo[];
}
