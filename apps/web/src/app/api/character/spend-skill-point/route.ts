import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/slack-auth';
import { spendSkillPoint } from '../../../lib/dm-player';

const VALID_ATTRIBUTES = ['strength', 'agility', 'health'] as const;
type Attribute = (typeof VALID_ATTRIBUTES)[number];

export const POST = async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    attribute?: string;
  } | null;

  if (!payload?.attribute || !VALID_ATTRIBUTES.includes(payload.attribute as Attribute)) {
    return NextResponse.json(
      { message: 'Missing or invalid attribute.' },
      { status: 400 },
    );
  }

  try {
    const result = await spendSkillPoint({
      teamId: session.teamId,
      userId: session.userId,
      attribute: payload.attribute as Attribute,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to spend skill point.' },
      { status: 400 },
    );
  }
};
