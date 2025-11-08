/**
 * Player Lookup Service
 * Centralizes all player database queries to abstract away client-specific details
 */

import { Player } from '@prisma/client';
import { getPrismaClient } from '../lib/database.js';

export interface SlackIdentifier {
  teamId: string;
  userId: string;
}

/**
 * Find a player by their Slack team and user ID
 */
export async function findPlayerBySlackUser(
  identifier: SlackIdentifier,
): Promise<Player | undefined> {
  const prisma = getPrismaClient();

  const slackUser = await prisma.slackUser.findUnique({
    where: {
      teamId_userId: {
        teamId: identifier.teamId,
        userId: identifier.userId,
      },
    },
    include: {
      player: {
        include: {
          slackUser: true,
        },
      },
    },
  });

  return slackUser?.player;
}

/**
 * Find a player by their database ID
 */
export async function findPlayerById(id: number) {
  const prisma = getPrismaClient();

  return await prisma.player.findUnique({
    where: { id },
    include: {
      slackUser: true,
    },
  });
}

/**
 * Find players at a specific location
 */
export async function findPlayersAtLocation(x: number, y: number) {
  const prisma = getPrismaClient();

  return await prisma.player.findMany({
    where: { x, y },
    include: {
      slackUser: true,
    },
  });
}

/**
 * Find all players in a Slack workspace/team
 */
export async function findPlayersByTeam(teamId: string) {
  const prisma = getPrismaClient();

  const slackUsers = await prisma.slackUser.findMany({
    where: { teamId },
    include: {
      player: {
        include: {
          slackUser: true,
        },
      },
    },
  });

  return slackUsers;
}

/**
 * Link an existing player to a Slack identity
 */
export async function linkPlayerToSlackIdentity(
  playerId: number,
  identifier: SlackIdentifier,
): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.slackUser.create({
    data: {
      playerId,
      teamId: identifier.teamId,
      userId: identifier.userId,
    },
  });
}

/**
 * Unlink a Slack identity from a player
 */
export async function unlinkPlayerFromSlackIdentity(
  identifier: SlackIdentifier,
): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.slackUser.delete({
    where: {
      teamId_userId: {
        teamId: identifier.teamId,
        userId: identifier.userId,
      },
    },
  });
}
