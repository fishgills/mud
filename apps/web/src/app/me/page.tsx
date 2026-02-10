import { getXpToNextLevel } from '@mud/constants';
import { getPrismaClient, ItemType, PlayerSlot } from '@mud/database';
import { buildInventoryModel } from '@mud/inventory';
import { buildCharacterSheetModel } from '@mud/character-sheet';
import { getSession } from '../lib/slack-auth';
import InventoryClient from './inventory/InventoryClient';

export const metadata = {
  title: 'Character',
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

const renderTicketIcon = (tone: 'rare' | 'epic' | 'legendary') => (
  <span className={`ticket-icon ticket-icon-${tone}`} aria-hidden="true">
    <svg
      className="ticket-icon-svg"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2.5 2.5 0 0 0 0 5v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-5V7z" />
    </svg>
  </span>
);

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

export default async function CharacterPage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="title-font text-3xl font-semibold tracking-tight">
            Character
          </h1>
        </header>
        <SectionDivider />
        <section className="text-base leading-7 text-[color:var(--ink-soft)]">
          <p>You are not signed in.</p>
        </section>
        <div>
          <a className="slack-auth-link" href="/api/auth/slack/start">
            Sign in with Slack
          </a>
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
            Character
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
      computedBonuses: {
        strengthBonus: pi.item.strengthBonus ?? 0,
        agilityBonus: pi.item.agilityBonus ?? 0,
        healthBonus: pi.item.healthBonus ?? 0,
      },
    };
  });

  const equipmentTotals = player.playerItems.reduce(
    (totals, pi) => {
      if (!pi.equipped || !pi.item) {
        return totals;
      }
      totals.strengthBonus += pi.item.strengthBonus ?? 0;
      totals.agilityBonus += pi.item.agilityBonus ?? 0;
      totals.healthBonus += pi.item.healthBonus ?? 0;
      const itemSlot = pi.slot ?? pi.item.slot;
      const isWeapon =
        itemSlot === PlayerSlot.weapon ||
        (typeof pi.item.type === 'string' &&
          pi.item.type.toUpperCase() === ItemType.WEAPON);
      if (isWeapon && pi.item.damageRoll && !totals.weaponDamageRoll) {
        totals.weaponDamageRoll = pi.item.damageRoll;
      }
      return totals;
    },
    {
      strengthBonus: 0,
      agilityBonus: 0,
      healthBonus: 0,
      weaponDamageRoll: null as string | null,
    },
  );

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
  const xpToNextLevel =
    typeof player.level === 'number' && typeof player.xp === 'number'
      ? getXpToNextLevel(player.level, player.xp)
      : null;
  const characterSheet = buildCharacterSheetModel({
    ...player,
    equipmentTotals,
    xpToNextLevel,
  });
  const ticketCounts = {
    rare: player.rareTickets ?? 0,
    epic: player.epicTickets ?? 0,
    legendary: player.legendaryTickets ?? 0,
  };

  return (
    <main className="page-card flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="title-font text-3xl font-semibold tracking-tight">
          Character
        </h1>
        <p className="text-sm text-[color:var(--ink-soft)]">
          {inventory.playerName} · Level {inventory.level ?? '?'} · HP{' '}
          {inventory.hp ?? '?'}/{inventory.maxHp ?? '?'}
        </p>
        <p className="text-sm text-[color:var(--ink-soft)]">
          <span className="shop-currency-line">
            <span
              className="currency-icon currency-icon-gold"
              aria-hidden="true"
            >
              G
            </span>
            Gold {inventory.gold}
          </span>
        </p>
        <p className="text-sm text-[color:var(--ink-soft)]">
          <span className="shop-currency-line shop-ticket-counts">
            <span
              className="currency-icon currency-icon-ticket"
              aria-hidden="true"
            >
              T
            </span>
            Tickets:
            <span className="shop-ticket-count">
              {renderTicketIcon('rare')}
              <span className="sr-only">Rare</span>
              {ticketCounts.rare}
            </span>
            <span className="shop-ticket-count">
              {renderTicketIcon('epic')}
              <span className="sr-only">Epic</span>
              {ticketCounts.epic}
            </span>
            <span className="shop-ticket-count">
              {renderTicketIcon('legendary')}
              <span className="sr-only">Legendary</span>
              {ticketCounts.legendary}
            </span>
          </span>
        </p>
      </header>

      <InventoryClient inventory={inventory} />

      <SectionDivider />

      <section className="character-sheet">
        {characterSheet.incompleteNotice ? (
          <p className="character-note">{characterSheet.incompleteNotice}</p>
        ) : null}
        {characterSheet.sections.map((section) => (
          <div key={section.title} className="character-section">
            <h2 className="title-font character-section-title">
              {section.title}
            </h2>
            <div className="character-grid">
              {section.fields.map((field) => (
                <div key={field.label} className="character-field">
                  <span className="character-label">{field.label}</span>
                  <span className="character-value">{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {characterSheet.xpContext ? (
          <p className="character-note">{characterSheet.xpContext}</p>
        ) : null}
        <p className="character-note">
          Skill points available: {characterSheet.skillPoints}
        </p>
      </section>
    </main>
  );
}
