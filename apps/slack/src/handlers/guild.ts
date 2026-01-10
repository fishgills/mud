import { COMMANDS } from '../commands';
import type { HqExitMode, TeleportResponse } from '../dm-client';
import { PlayerCommandHandler } from './base';
import { HandlerContext } from './types';
import { getOccupantsSummaryAt } from './locationUtils';
import { sendPngMap } from './mapUtils';

const RETURN_KEYWORDS = new Set([
  'return',
  'back',
  'last',
  'previous',
  'world',
  'exit',
  'leave',
  'home',
]);

const RANDOM_KEYWORDS = new Set(['random', 'fresh', 'new', 'wild']);

export const guildHandlerHelp = `Enter the HQ safe zone with "${COMMANDS.GUILD}". While inside, use \`${COMMANDS.GUILD} return\` to go back to your last location or \`${COMMANDS.GUILD} random\` for a fresh spawn.`;

function resolveRequestedMode(text: string): HqExitMode | undefined {
  const tokens = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return undefined;
  const [, ...keywords] = tokens;
  for (const token of keywords) {
    if (RETURN_KEYWORDS.has(token)) {
      return 'return';
    }
    if (RANDOM_KEYWORDS.has(token)) {
      return 'random';
    }
  }
  return undefined;
}

function fallbackTeleportMessage(result: TeleportResponse): string {
  switch (result.state) {
    case 'entered': {
      const last = result.lastWorldPosition;
      const coordText =
        last && typeof last.x === 'number' && typeof last.y === 'number'
          ? `Your last world location (${last.x}, ${last.y}) has been saved.`
          : 'Your last world location has been saved.';
      return `You arrive inside HQ. ${coordText}`;
    }
    case 'awaiting_choice':
      return `You are already inside HQ. Use \`return\` to go back to your last location or \`random\` to spawn at a safe spot.`;
    case 'exited': {
      const dest = result.destination;
      if (dest && typeof dest.x === 'number' && typeof dest.y === 'number') {
        const modeLabel =
          (result.mode ?? 'random') === 'return'
            ? 'last saved location'
            : 'fresh spawn';
        return `You depart HQ and arrive at (${dest.x}, ${dest.y}) - ${modeLabel}.`;
      }
      return 'You depart HQ and return to the world.';
    }
    default:
      return 'Teleport action completed.';
  }
}

export class GuildHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.GUILD, 'Guild command failed');
  }

  protected async perform({
    userId,
    say,
    text,
  }: HandlerContext): Promise<void> {
    const teamId = this.teamId!;
    const requestedMode = resolveRequestedMode(text);

    const timing = {
      start: Date.now(),
      dmMs: 0,
      mapMs: 0,
      occupantsMs: 0,
    };

    const dmStart = Date.now();
    const result = await this.dm.teleportPlayer({
      teamId,
      userId,
      mode: requestedMode,
    });
    timing.dmMs = Date.now() - dmStart;

    if (!result.success) {
      await say({ text: result.message ?? 'Guild command failed.' });
      this.app.logger.info(
        {
          userId,
          teamId,
          requestedMode: requestedMode ?? 'auto',
          state: 'failed',
          dmMs: timing.dmMs,
          totalMs: Date.now() - timing.start,
        },
        'Guild handler failure',
      );
      return;
    }

    const message = result.message ?? fallbackTeleportMessage(result);

    if (result.state === 'entered') {
      await say({ text: message });
      this.app.logger.info(
        {
          userId,
          teamId,
          requestedMode: requestedMode ?? 'auto',
          state: result.state,
          dmMs: timing.dmMs,
          totalMs: Date.now() - timing.start,
        },
        'Guild handler entered HQ',
      );
      return;
    }

    if (result.state === 'awaiting_choice') {
      await say({ text: message });
      this.app.logger.info(
        {
          userId,
          teamId,
          requestedMode: requestedMode ?? 'auto',
          state: result.state,
          dmMs: timing.dmMs,
          totalMs: Date.now() - timing.start,
        },
        'Guild handler awaiting choice',
      );
      return;
    }

    const destination =
      result.destination &&
      typeof result.destination.x === 'number' &&
      typeof result.destination.y === 'number'
        ? result.destination
        : result.player &&
            typeof result.player.x === 'number' &&
            typeof result.player.y === 'number'
          ? { x: result.player.x, y: result.player.y }
          : undefined;

    if (destination) {
      const mapStart = Date.now();
      try {
        await sendPngMap(say, destination.x, destination.y);
      } catch (err) {
        this.app.logger.warn(
          { err, userId, destination },
          'Guild handler map render failed',
        );
      }
      timing.mapMs = Date.now() - mapStart;

      const occupantsStart = Date.now();
      try {
        const occupants = await getOccupantsSummaryAt(
          destination.x,
          destination.y,
          {
            currentSlackUserId: userId,
            currentSlackTeamId: teamId,
          },
        );
        if (occupants) {
          await say({ text: occupants });
        }
      } catch (err) {
        this.app.logger.warn(
          { err, userId, destination },
          'Guild handler occupants summary failed',
        );
      }
      timing.occupantsMs = Date.now() - occupantsStart;
    }

    await say({ text: message });

    const totalMs = Date.now() - timing.start;
    this.app.logger.info(
      {
        userId,
        teamId,
        requestedMode: requestedMode ?? 'auto',
        state: result.state,
        dmMs: timing.dmMs,
        mapMs: timing.mapMs,
        occupantsMs: timing.occupantsMs,
        totalMs,
      },
      'Guild handler exited HQ',
    );
  }
}

export const guildHandler = new GuildHandler();
