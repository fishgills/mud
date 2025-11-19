import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';
import type { HandlerContext } from './types';

const describeServices = (services: {
  shop?: boolean;
  crier?: boolean;
  exits?: string[];
}): string => {
  if (!services) return 'Guild services are warming up.';
  const flags: string[] = [];
  if (services.shop) flags.push('Shop is open');
  if (services.crier) flags.push('Town crier active');
  if (services.exits?.length) {
    flags.push(`Exits: ${services.exits.join(', ')}`);
  }
  return flags.length > 0
    ? flags.join(' • ')
    : 'Guild services are warming up.';
};

export class GuildHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.GUILD, 'Guild teleport failed');
  }

  protected async perform({
    teamId,
    userId,
    say,
  }: HandlerContext): Promise<void> {
    const response = await this.dm.guildTeleport({ teamId, userId });

    if (!response?.success) {
      await say({ text: response?.message ?? 'Guild teleport failed.' });
      return;
    }

    const servicesLine = describeServices(response.services);
    const occupantLine = response.occupantsNotified?.length
      ? `Heads-up sent to ${response.occupantsNotified.length} guildmate(s).`
      : undefined;

    const sections = [response.arrivalMessage, servicesLine, occupantLine]
      .filter(Boolean)
      .join('\n');

    await say({ text: sections });

    this.app.logger.info(
      {
        teamId,
        userId,
        correlationId: response.correlationId,
        occupants: response.occupantsNotified?.length ?? 0,
      },
      'Guild teleport succeeded',
    );
  }
}

export const guildHandler = new GuildHandler();
