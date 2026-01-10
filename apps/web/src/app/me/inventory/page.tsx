import Link from 'next/link';
import { getPrismaClient } from '@mud/database';
import { buildInventoryModel } from '@mud/inventory';
import { getSession } from '../../lib/slack-auth';

export const metadata = {
  title: 'Inventory',
};

const getPlayerWithItems = async (teamId: string, userId: string) => {
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

  if (!slackUser?.player) {
    return null;
  }

  // Transform playerItems to match the inventory model format
  const bag = slackUser.player.playerItems.map((pi) => ({
    id: pi.id,
    itemId: pi.itemId,
    itemName: pi.item.name,
    quality: pi.quality,
    slot: pi.slot,
    equipped: pi.equipped,
    damageRoll: pi.item.damageRoll,
    defense: pi.item.defense,
    computedBonuses: null, // We'll need to compute this from the item stats
    allowedSlots: pi.item.allowedSlots,
    item: {
      damageRoll: pi.item.damageRoll,
      defense: pi.item.defense,
    },
  }));

  return {
    ...slackUser.player,
    bag,
  };
};

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

  const player = await getPlayerWithItems(session.teamId, session.userId);

  if (!player) {
    return (
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="title-font text-3xl font-semibold tracking-tight">
            Your Inventory
          </h1>
        </header>
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

  return (
    <main className="page-card flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="title-font text-3xl font-semibold tracking-tight">
          {player.name}&apos;s Inventory
        </h1>
      </header>
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
      {(() => {
        const inventory = buildInventoryModel(player);
        return (
          <section className="inventory-view">
            <div className="inventory-summary">
              <div className="inventory-stat">
                <span className="inventory-stat-label">Level</span>
                <span className="inventory-stat-value">{inventory.level}</span>
              </div>
              <div className="inventory-stat">
                <span className="inventory-stat-label">HP</span>
                <span className="inventory-stat-value">{inventory.hp}</span>
              </div>
              <div className="inventory-stat">
                <span className="inventory-stat-label">Gold</span>
                <span className="inventory-stat-value">{inventory.gold}</span>
              </div>
              <div className="inventory-stat">
                <span className="inventory-stat-label">Position</span>
                <span className="inventory-stat-value">
                  {inventory.position}
                </span>
              </div>
            </div>

            <div className="section-divider" aria-hidden="true">
              <svg
                className="divider-icon"
                viewBox="0 0 24 24"
                role="img"
                aria-label="Divider"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              >
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            <div className="inventory-section">
              <h2 className="title-font inventory-section-title">
                Equipped Gear
              </h2>
              <div className="inventory-grid">
                {inventory.equippedSlots.map((slot) => (
                  <div key={slot.slot} className="inventory-item-card">
                    <div className="inventory-item-header">
                      <span className="inventory-slot-label">{slot.label}</span>
                    </div>
                    {slot.item ? (
                      <>
                        <div className="inventory-item-name">
                          <span className="quality-badge">
                            {slot.item.qualityBadge}
                          </span>
                          <span className="quality-label">
                            {slot.item.quality}
                          </span>
                          <span className="item-name">{slot.item.name}</span>
                        </div>
                        {slot.item.stats.length > 0 && (
                          <ul className="inventory-item-stats">
                            {slot.item.stats.map((stat, idx) => (
                              <li key={idx}>{stat}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <div className="inventory-item-empty">Empty</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="section-divider" aria-hidden="true">
              <svg
                className="divider-icon"
                viewBox="0 0 24 24"
                role="img"
                aria-label="Divider"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              >
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            <div className="inventory-section">
              <h2 className="title-font inventory-section-title">Backpack</h2>
              {inventory.backpackItems.length === 0 ? (
                <p className="inventory-empty-message">
                  Your backpack is empty.
                </p>
              ) : (
                <div className="inventory-grid">
                  {inventory.backpackItems.map((item) => (
                    <div key={item.id} className="inventory-item-card">
                      <div className="inventory-item-name">
                        <span className="quality-badge">
                          {item.qualityBadge}
                        </span>
                        <span className="quality-label">{item.quality}</span>
                        <span className="item-name">{item.name}</span>
                      </div>
                      {item.stats.length > 0 && (
                        <ul className="inventory-item-stats">
                          {item.stats.map((stat, idx) => (
                            <li key={idx}>{stat}</li>
                          ))}
                        </ul>
                      )}
                      {item.allowedSlots && item.allowedSlots.length > 0 && (
                        <div className="inventory-item-slots">
                          Can equip in: {item.allowedSlots.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })()}
    </main>
  );
}
