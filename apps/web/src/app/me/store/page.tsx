import { getPrismaClient } from '@mud/database';
import {
  buildInventoryModel,
  getQualityBadge,
  getQualityLabel,
  type ItemStatLine,
} from '@mud/inventory';
import { getSession } from '../../lib/slack-auth';
import ShopClient, {
  type ShopCatalogItemView,
  type ShopSellItemView,
} from './ShopClient';

export const metadata = {
  title: 'Guild Store',
};

const formatWeaponRoll = (count?: number | null, sides?: number | null) => {
  if (!count || !sides) return null;
  return `${count}d${sides}`;
};

const getPlayerForStore = async (teamId: string, userId: string) => {
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

const getShopCatalog = async () => {
  const prisma = getPrismaClient();
  return prisma.shopCatalogItem.findMany({
    where: { isActive: true },
    include: { itemTemplate: true },
    orderBy: [{ buyPriceGold: 'asc' }, { name: 'asc' }],
  });
};

const getShopState = async () => {
  const prisma = getPrismaClient();
  return prisma.guildShopState.findFirst({
    orderBy: { lastRefreshedAt: 'desc' },
  });
};

const PixelDivider = () => (
  <div className="divider" aria-hidden="true">
    <div className="divider-line" />
    <span className="divider-glyph">⚔</span>
    <div className="divider-line" />
  </div>
);

export default async function StorePage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="layout">
        <main className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="pixel-h2">GUILD STORE</div>
          <PixelDivider />
          <p style={{ fontFamily: "'VT323',monospace", fontSize: 18, color: 'var(--ink-soft)' }}>You are not signed in.</p>
          <a className="btn btn-slack" href="/api/auth/slack/start" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>SIGN IN WITH SLACK</a>
        </main>
      </div>
    );
  }

  const [player, catalog, shopState] = await Promise.all([
    getPlayerForStore(session.teamId, session.userId),
    getShopCatalog(),
    getShopState(),
  ]);

  if (!player) {
    return (
      <div className="layout">
        <main className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="pixel-h2">GUILD STORE</div>
          <PixelDivider />
          <div className="page-text">
            <p>No character was found for this Slack account.</p>
            <p>Start a character in Slack by messaging the BattleForge bot with <span style={{ color: 'var(--gold)' }}>new YourName</span>.</p>
          </div>
        </main>
      </div>
    );
  }

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
    computedBonuses: {
      strengthBonus: pi.item.strengthBonus ?? 0,
      agilityBonus: pi.item.agilityBonus ?? 0,
      healthBonus: pi.item.healthBonus ?? 0,
      weaponDamageRoll: pi.item.damageRoll ?? null,
    },
  }));

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

  const catalogView: ShopCatalogItemView[] = catalog.map((item) => {
    const quality = item.quality ?? 'Common';
    return {
      sku: item.sku,
      name: item.name,
      description: item.description ?? '',
      buyPriceGold: item.buyPriceGold,
      sellPriceGold: item.sellPriceGold,
      stockQuantity: item.stockQuantity,
      tags: item.tags ?? [],
      qualityBadge: getQualityBadge(quality),
      qualityLabel: getQualityLabel(quality),
      damageRoll:
        item.itemTemplate?.damageRoll ??
        formatWeaponRoll(item.weaponDiceCount, item.weaponDiceSides),
      strengthBonus: item.strengthBonus,
      agilityBonus: item.agilityBonus,
      healthBonus: item.healthBonus,
      ticketRequirement: item.ticketRequirement,
    };
  });

  const catalogByTemplateId = new Map(
    catalog
      .filter((entry) => entry.itemTemplateId)
      .map((entry) => [entry.itemTemplateId as number, entry]),
  );

  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));

  const sellItems: ShopSellItemView[] = inventory.backpackItems
    .filter((item) => typeof item.id === 'number')
    .map((item) => {
      const source = inventoryById.get(item.id!);
      const templateId = source?.itemId ?? null;
      const catalogEntry = templateId
        ? catalogByTemplateId.get(templateId)
        : undefined;
      const baseValue = source?.value ?? item.value ?? 0;
      const sellPriceGold = catalogEntry
        ? catalogEntry.sellPriceGold
        : Math.max(1, Math.floor(baseValue * 0.5));
      return {
        id: item.id!,
        name: item.name,
        qualityBadge: item.qualityBadge,
        qualityLabel: item.qualityLabel,
        quantity: item.quantity,
        stats: item.stats as ItemStatLine[],
        description: item.description,
        sellPriceGold,
      };
    });

  const ticketCounts = {
    rare: player.rareTickets ?? 0,
    epic: player.epicTickets ?? 0,
    legendary: player.legendaryTickets ?? 0,
  };
  const refreshIntervalRaw = Number(
    process.env.GUILD_SHOP_ROTATION_INTERVAL_MS,
  );
  const refreshIntervalMs = Number.isFinite(refreshIntervalRaw)
    ? refreshIntervalRaw
    : 0;
  const lastRefreshAt = shopState?.lastRefreshedAt
    ? shopState.lastRefreshedAt.toISOString()
    : null;
  return (
    <div className="layout">
      <main className="panel panel-wide" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="pixel-h1" style={{ fontSize: 12 }}>GUILD STORE</div>
          <p style={{ fontFamily: "'VT323',monospace", fontSize: 17, color: 'var(--ink-soft)' }}>Trade with the guild merchants</p>
          <div className="currency-row">
            <div className="currency-chip chip-gold">
              <span>⬡</span>
              <span>{inventory.gold.toLocaleString()}</span>
              <span className="chip-label">GOLD</span>
            </div>
            {ticketCounts.rare > 0 && (
              <div className="currency-chip chip-rare">
                <span>{ticketCounts.rare}</span>
                <span className="chip-label">RARE TICKETS</span>
              </div>
            )}
            {ticketCounts.epic > 0 && (
              <div className="currency-chip chip-epic">
                <span>{ticketCounts.epic}</span>
                <span className="chip-label">EPIC TICKETS</span>
              </div>
            )}
            {ticketCounts.legendary > 0 && (
              <div className="currency-chip chip-legendary">
                <span>{ticketCounts.legendary}</span>
                <span className="chip-label">LEGENDARY TICKETS</span>
              </div>
            )}
          </div>
        </header>

        <PixelDivider />

        <ShopClient
          catalog={catalogView}
          sellItems={sellItems}
          playerGold={inventory.gold}
          ticketCounts={ticketCounts}
          refreshIntervalMs={refreshIntervalMs}
          lastRefreshAt={lastRefreshAt}
        />
      </main>
    </div>
  );
}
