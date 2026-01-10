import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/slack-auth';
import { buyShopItem } from '../../../lib/dm-shop';

export const POST = async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    sku?: string;
    quantity?: number;
  } | null;
  if (!payload?.sku) {
    return NextResponse.json({ message: 'Missing item SKU.' }, { status: 400 });
  }

  try {
    const result = await buyShopItem({
      teamId: session.teamId,
      userId: session.userId,
      sku: payload.sku,
      quantity:
        typeof payload.quantity === 'number' && payload.quantity > 0
          ? payload.quantity
          : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Purchase failed.' },
      { status: 400 },
    );
  }
};
