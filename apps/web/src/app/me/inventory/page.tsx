import Link from 'next/link';
import { getPrismaClient } from '@mud/database';
import { buildInventoryModel } from '@mud/inventory';
import { getSession } from '../../lib/slack-auth';

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
  const inventoryItems = player.playerItems.map((pi) => ({
    id: pi.id,
    itemId: pi.itemId,
    itemName: pi.item.name,
    quality: pi.quality,
    quantity: pi.quantity,
    rank: pi.rank,
    equipped: pi.equipped,
    slot: pi.slot,
    allowedSlots: pi.item.slot ? [pi.item.slot] : [],
    damageRoll: pi.item.damageRoll,
    defense: pi.item.defense,
    value: pi.item.value,
    description: pi.item.description,
    itemType: pi.item.type,
  }));

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
    x: player.x,
    y: player.y,
    isInHq: player.isInHq,
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

      <SectionDivider />

      {/* Equipped Gear Section */}
      <section className="inventory-section">
        <h2 className="title-font inventory-section-title">Equipped Gear</h2>
        <div className="inventory-grid">
          {inventory.equippedSlots.map((slot) => (
            <div key={slot.key} className="inventory-slot">
              <span className="inventory-slot-label">{slot.label}</span>
              {slot.item ? (
                <div className="inventory-item">
                  <span className="inventory-item-name">
                    {slot.item.qualityBadge} {slot.item.qualityLabel}{' '}
                    {slot.item.name}
                  </span>
                  {slot.item.stats.length > 0 && (
                    <div className="inventory-item-stats">
                      {slot.item.stats.map((stat, i) => (
                        <span key={i} className="inventory-stat">
                          {stat.label}: {stat.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className="inventory-empty">Empty</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* Backpack Section */}
      <section className="inventory-section">
        <h2 className="title-font inventory-section-title">
          Backpack ({inventory.totalBackpack} items)
        </h2>
        {inventory.backpackItems.length === 0 ? (
          <p className="text-[color:var(--ink-soft)] text-sm italic">
            Your backpack is empty.
          </p>
        ) : (
          <div className="inventory-list">
            {inventory.backpackItems.map((item) => (
              <div key={item.id} className="inventory-backpack-item">
                <div className="inventory-item-header">
                  <span className="inventory-item-name">
                    {item.qualityBadge} {item.qualityLabel} {item.name}
                  </span>
                  {item.quantity > 1 && (
                    <span className="inventory-quantity">x{item.quantity}</span>
                  )}
                </div>
                {item.stats.length > 0 && (
                  <div className="inventory-item-stats">
                    {item.stats.map((stat, i) => (
                      <span key={i} className="inventory-stat">
                        {stat.label}: {stat.value}
                      </span>
                    ))}
                  </div>
                )}
                {item.description && (
                  <p className="inventory-item-desc">{item.description}</p>
                )}
                <div className="inventory-item-meta">
                  {item.canEquip && (
                    <span className="inventory-equippable">Equippable</span>
                  )}
                  {item.value && (
                    <span className="inventory-value">{item.value} gold</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
