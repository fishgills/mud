import { NextResponse } from 'next/server';
import { setSessionCookie } from '../../../../lib/slack-auth';
import { getPrismaClient } from '@mud/database';

/**
 * Test authentication endpoint for Playwright and local testing
 * Creates a test session without requiring Slack OAuth
 *
 * Only works in development mode (NODE_ENV !== 'production')
 */
export async function GET(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test auth endpoint disabled in production' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get('redirect') || '/me/store';

  // Use test credentials
  const TEST_TEAM_ID = 'T_TEST_TEAM';
  const TEST_USER_ID = 'U_TEST_USER';

  try {
    const prisma = getPrismaClient();

    // Ensure test SlackUser and Player exist
    let slackUser = await prisma.slackUser.findUnique({
      where: {
        teamId_userId: {
          teamId: TEST_TEAM_ID,
          userId: TEST_USER_ID,
        },
      },
      include: { player: true },
    });

    if (!slackUser) {
      // Create test player and slack user
      const player = await prisma.player.create({
        data: {
          name: 'Test Hero',
          level: 10,
          hp: 100,
          maxHp: 100,
          gold: 10000, // Give plenty of gold for testing
        },
      });

      slackUser = await prisma.slackUser.create({
        data: {
          teamId: TEST_TEAM_ID,
          userId: TEST_USER_ID,
          playerId: player.id,
        },
        include: { player: true },
      });
    }

    // Create response and set session cookie
    const response = NextResponse.redirect(new URL(redirect, request.url));
    setSessionCookie(response, TEST_TEAM_ID, TEST_USER_ID);

    return response;
  } catch (error) {
    console.error('Test auth error:', error);
    return NextResponse.json(
      { error: 'Failed to create test session' },
      { status: 500 },
    );
  }
}
