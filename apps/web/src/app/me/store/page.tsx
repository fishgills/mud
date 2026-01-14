import Link from 'next/link';
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

const SectionDivider = () => (
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

export default async function StorePage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="title-font text-3xl font-semibold tracking-tight">
            Guild Store
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

  const [player, catalog] = await Promise.all([
    getPlayerForStore(session.teamId, session.userId),
    getShopCatalog(),
  ]);

  if (!player) {
    return (
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="title-font text-3xl font-semibold tracking-tight">
            Guild Store
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
      damageRoll: item.itemTemplate?.damageRoll ?? null,
      defense: item.itemTemplate?.defense ?? null,
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

  return (
    <main className="page-card flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="title-font text-3xl font-semibold tracking-tight">
          Guild Store
        </h1>
        <p className="text-sm text-[color:var(--ink-soft)]">
          Gold {inventory.gold} · Rotates on tick events
        </p>
      </header>

      <SectionDivider />

      <section className="text-sm text-[color:var(--ink-soft)]">
        <p>
          Buy new gear from the guild merchants, or sell extra items from your
          backpack.
        </p>
      </section>

      <ShopClient catalog={catalogView} sellItems={sellItems} />
    </main>
  );
}
