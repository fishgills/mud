import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/slack-auth';
import { sellShopItem } from '../../../lib/dm-shop';

export const POST = async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    playerItemId?: number;
    quantity?: number;
  } | null;

  if (!payload?.playerItemId) {
    return NextResponse.json(
      { message: 'Missing inventory item.' },
      { status: 400 },
    );
  }

  try {
    const result = await sellShopItem({
      teamId: session.teamId,
      userId: session.userId,
      playerItemId: payload.playerItemId,
      quantity:
        typeof payload.quantity === 'number' && payload.quantity > 0
          ? payload.quantity
          : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Sale failed.' },
      { status: 400 },
    );
  }
};
