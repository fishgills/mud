import Link from 'next/link';
import { getPrismaClient, ItemType, PlayerSlot } from '@mud/database';
import { buildInventoryModel } from '@mud/inventory';
import { getSession } from '../../lib/slack-auth';
import InventoryClient from './InventoryClient';

export const metadata = {
  title: 'Inventory',
};

const getPlayerWithInventory = async (teamId: string, userId: string) => {
  const prisma = getPrismaClient();
  const slackUser = await prisma.slackUser.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
    include: {
      player: {
        include: {
          playerItems: {
            include: {
              item: true,
            },
          },
        },
      },
    },
  });
  return slackUser?.player ?? null;
};

// Section Divider component
function SectionDivider() {
  return (
    <div className="section-divider" aria-hidden="true">
      <svg
        className="divider-icon"
        viewBox="0 0 24 24"
        role="img"
        aria-label="Crossed blades"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 4l4 4" />
        <path d="M4 5l3 3" />
        <path d="M9 9l-2 2" />
        <path d="M19 4l-4 4" />
        <path d="M20 5l-3 3" />
        <path d="M15 9l2 2" />
        <path d="M7 13l10 6" />
        <path d="M17 13l-10 6" />
      </svg>
    </div>
  );
}

export default async function InventoryPage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="title-font text-3xl font-semibold tracking-tight">
            Your Inventory
          </h1>
        </header>
        <SectionDivider />
        <section className="text-base leading-7 text-[color:var(--ink-soft)]">
          <p>You are not signed in.</p>
        </section>
        <div>
          <Link className="slack-auth-link" href="/api/auth/slack/start">
            Sign in with Slack
          </Link>
        </div>
      </main>
    );
  }

  const player = await getPlayerWithInventory(session.teamId, session.userId);

  if (!player) {
    return (
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="title-font text-3xl font-semibold tracking-tight">
            Your Inventory
          </h1>
        </header>
        <SectionDivider />
        <section className="text-base leading-7 text-[color:var(--ink-soft)]">
          <p>No character was found for this Slack account.</p>
          <p>
            Start a character in Slack by messaging the BattleForge bot with
            <span className="font-semibold"> new YourName</span>.
          </p>
        </section>
      </main>
    );
  }

  // Transform database items to inventory format
  const inventoryItems = player.playerItems.map((pi) => {
    const allowedSlots: string[] = [];
    if (pi.item.slot) {
      allowedSlots.push(pi.item.slot);
    } else if (
      typeof pi.item.type === 'string' &&
      pi.item.type.toUpperCase() === ItemType.WEAPON
    ) {
      allowedSlots.push(PlayerSlot.weapon);
    }
    return {
      id: pi.id,
      itemId: pi.itemId,
      itemName: pi.item.name,
      quality: pi.quality,
      quantity: pi.quantity,
      rank: pi.rank,
      equipped: pi.equipped,
      slot: pi.slot,
      allowedSlots,
      damageRoll: pi.item.damageRoll,
      defense: pi.item.defense,
      value: pi.item.value,
      description: pi.item.description,
      itemType: pi.item.type,
    };
  });

  // Build equipment map from equipped items
  // The inventory model builder will also check bag items for equipped=true
  const equipment: Record<string, { id: number; quality: string } | null> = {};
  for (const pi of player.playerItems) {
    if (pi.equipped && pi.slot) {
      equipment[pi.slot] = { id: pi.id, quality: pi.quality };
    }
  }

  const inventory = buildInventoryModel({
    name: player.name,
    level: player.level,
    hp: player.hp,
    maxHp: player.maxHp,
    gold: player.gold,
    equipment: equipment ?? undefined,
    bag: inventoryItems,
  });

  return (
    <main className="page-card flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="title-font text-3xl font-semibold tracking-tight">
          {inventory.playerName}&apos;s Inventory
        </h1>
        <p className="text-sm text-[color:var(--ink-soft)]">
          Level {inventory.level ?? '?'} · HP {inventory.hp ?? '?'}/
          {inventory.maxHp ?? '?'} · Gold {inventory.gold}
        </p>
      </header>

      <InventoryClient inventory={inventory} />
    </main>
  );
}
