import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/slack-auth';
import { equipItem } from '../../../lib/dm-player';

export const POST = async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    playerItemId?: number;
    slot?: string;
  } | null;

  if (!payload?.playerItemId || !payload?.slot) {
    return NextResponse.json(
      { message: 'Missing inventory item or slot.' },
      { status: 400 },
    );
  }

  try {
    const result = await equipItem({
      teamId: session.teamId,
      userId: session.userId,
      playerItemId: payload.playerItemId,
      slot: payload.slot,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Equip failed.' },
      { status: 400 },
    );
  }
};
