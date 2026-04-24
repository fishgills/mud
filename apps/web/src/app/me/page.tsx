import { getXpToNextLevel } from '@mud/constants';
import { getPrismaClient, ItemType, PlayerSlot } from '@mud/database';
import { buildInventoryModel } from '@mud/inventory';
import { buildCharacterSheetModel } from '@mud/character-sheet';
import { getSession } from '../lib/slack-auth';
import InventoryClient from './inventory/InventoryClient';
import AttributesClient from './AttributesClient';

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


function PixelDivider() {
  return (
    <div className="divider" aria-hidden="true">
      <div className="divider-line" />
      <span className="divider-glyph">⚔</span>
      <div className="divider-line" />
    </div>
  );
}

export default async function CharacterPage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="layout">
        <main className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="pixel-h1">CHARACTER</div>
          <PixelDivider />
          <p style={{ fontFamily: "'VT323',monospace", fontSize: 18, color: 'var(--ink-soft)' }}>
            You are not signed in.
          </p>
          <div>
            <a className="btn btn-slack" href="/api/auth/slack/start">SIGN IN</a>
          </div>
        </main>
      </div>
    );
  }

  const player = await getPlayerWithInventory(session.teamId, session.userId);

  if (!player) {
    return (
      <div className="layout">
        <main className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="pixel-h1">CHARACTER</div>
          <PixelDivider />
          <p style={{ fontFamily: "'VT323',monospace", fontSize: 18, color: 'var(--ink-soft)' }}>
            No character was found for this Slack account.
          </p>
          <p style={{ fontFamily: "'VT323',monospace", fontSize: 18, color: 'var(--ink-soft)' }}>
            Start a character in Slack by messaging the BattleForge bot with{' '}
            <span style={{ color: 'var(--gold)' }}>new YourName</span>.
          </p>
        </main>
      </div>
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

  const hp = inventory.hp ?? 0;
  const maxHp = inventory.maxHp ?? 1;
  const hpPct = maxHp > 0 ? Math.min(100, Math.max(0, (hp / maxHp) * 100)) : 0;

  return (
    <div className="layout">
      <main className="panel panel-wide" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="pixel-h1">{inventory.playerName}</div>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: 'var(--ink-soft)' }}>
            ADVENTURER · LVL {inventory.level ?? '?'}
          </div>
        </header>

        <div className="currency-row">
          <div className="currency-chip chip-gold">
            <span>⬡</span>
            <span>{inventory.gold.toLocaleString()}</span>
            <span className="chip-label">GOLD</span>
          </div>
          {ticketCounts.rare > 0 && (
            <div className="currency-chip chip-rare">
              <span>{ticketCounts.rare}</span>
              <span className="chip-label">RARE</span>
            </div>
          )}
          {ticketCounts.epic > 0 && (
            <div className="currency-chip chip-epic">
              <span>{ticketCounts.epic}</span>
              <span className="chip-label">EPIC</span>
            </div>
          )}
          {ticketCounts.legendary > 0 && (
            <div className="currency-chip chip-legendary">
              <span>{ticketCounts.legendary}</span>
              <span className="chip-label">LEGENDARY</span>
            </div>
          )}
        </div>

        <div className="bar-row">
          <span className="bar-key" style={{ color: 'var(--hp)' }}>HP</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                background: hpPct < 25 ? 'var(--hp-low)' : 'var(--hp)',
                width: `${hpPct}%`,
              }}
            />
          </div>
          <span className="bar-val">{hp}/{maxHp}</span>
        </div>

        <PixelDivider />

        <InventoryClient inventory={inventory} />

        <PixelDivider />

        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {characterSheet.incompleteNotice ? (
            <p style={{ fontFamily: "'VT323',monospace", fontSize: 16, color: 'var(--ink-soft)' }}>
              {characterSheet.incompleteNotice}
            </p>
          ) : null}
          {characterSheet.sections.map((section) => (
            <div key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="pixel-h3">{section.title}</div>
              {section.title === 'Attributes' ? (
                <AttributesClient
                  fields={section.fields}
                  skillPoints={characterSheet.skillPoints}
                />
              ) : (
                <div className="stat-grid">
                  {section.fields.map((field) => (
                    <div key={field.label} className="stat-field">
                      <span className="stat-key">{field.label}</span>
                      <span className="stat-val">{field.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <p style={{ fontFamily: "'VT323',monospace", fontSize: 16, color: 'var(--ink-soft)' }}>
            Skill points available: {characterSheet.skillPoints}
          </p>
        </section>
      </main>
    </div>
  );
}
