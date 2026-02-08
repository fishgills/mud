import { COMMANDS } from '../../commands';
import type { GuildInvitesResponse } from '../../dm-client';
import { PlayerCommandHandler } from '../base';
import type { HandlerContext } from '../types';

const buildGuildSummary = (data: {
  name: string;
  members: Array<{ name: string; isLeader: boolean }>;
}) => {
  const roster = data.members
    .map((member) => `${member.isLeader ? '*' : '-'} ${member.name}`)
    .join('\n');
  const count = data.members.length;
  return `Guild ${data.name} (${count} member${count === 1 ? '' : 's'})\n${roster}`;
};

export class GuildHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.GUILD, 'Unable to manage guilds');
  }

  protected async perform({ teamId, userId, text, say }: HandlerContext) {
    const tokens = text.trim().split(/\s+/);
    const subcommand = tokens[1]?.toLowerCase();

    if (!subcommand || subcommand === 'info') {
      const info = await this.dm.guildInfo({ teamId, userId });
      if (!info.success) {
        await say({ text: info.message ?? 'Unable to load guild info.' });
        return;
      }
      if (!info.data) {
        await say({ text: 'You are not in a guild yet.' });
        return;
      }
      await say({ text: buildGuildSummary(info.data) });
      return;
    }

    if (subcommand === 'invites') {
      const invites = await this.dm.guildInvites({ teamId, userId });
      if (!invites.success) {
        await say({ text: invites.message ?? 'Unable to load invites.' });
        return;
      }
      const list: NonNullable<GuildInvitesResponse['data']> =
        invites.data ?? [];
      if (list.length === 0) {
        await say({ text: 'You do not have any pending guild invites.' });
        return;
      }
      const lines = list.map(
        (invite) => `- ${invite.guildName} (invited by ${invite.inviterName})`,
      );
      await say({
        text: `Pending invites:\n${lines.join('\n')}`,
      });
      return;
    }

    if (subcommand === 'create') {
      const name = tokens.slice(2).join(' ').trim();
      if (!name) {
        await say({
          text: `Name your guild with \`${COMMANDS.GUILD} create <name>\`.`,
        });
        return;
      }
      const result = await this.dm.guildCreate({ teamId, userId, name });
      if (!result.success) {
        await say({ text: result.message ?? 'Unable to create guild.' });
        return;
      }
      await say({ text: result.message ?? `Guild created: ${name}.` });
      return;
    }

    if (subcommand === 'invite') {
      const target = tokens[2] ?? '';
      const mentionMatch = target.match(/^<@([A-Z0-9]+)>$/i);
      if (!mentionMatch) {
        await say({
          text: `Invite a player with \`${COMMANDS.GUILD} invite @player\`.`,
        });
        return;
      }
      const result = await this.dm.guildInvite({
        teamId,
        userId,
        targetUserId: mentionMatch[1],
      });
      if (!result.success) {
        await say({ text: result.message ?? 'Unable to send invite.' });
        return;
      }
      await say({ text: result.message ?? 'Invite sent.' });
      return;
    }

    if (subcommand === 'join') {
      const name = tokens.slice(2).join(' ').trim();
      const result = await this.dm.guildJoin({
        teamId,
        userId,
        guildName: name || undefined,
      });
      if (!result.success) {
        await say({ text: result.message ?? 'Unable to join guild.' });
        return;
      }
      await say({ text: result.message ?? 'Joined guild.' });
      return;
    }

    if (subcommand === 'leave') {
      const result = await this.dm.guildLeave({ teamId, userId });
      if (!result.success) {
        await say({ text: result.message ?? 'Unable to leave guild.' });
        return;
      }
      await say({ text: result.message ?? 'Left guild.' });
      return;
    }

    await say({
      text: `Guild commands: \`${COMMANDS.GUILD} info\`, \`${COMMANDS.GUILD} invites\`, \`${COMMANDS.GUILD} create <name>\`, \`${COMMANDS.GUILD} invite @player\`, \`${COMMANDS.GUILD} join [name]\`, \`${COMMANDS.GUILD} leave\`.`,
    });
  }
}

export const guildHandler = new GuildHandler();
