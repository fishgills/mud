import fs from 'fs';
import path from 'path';
import process from 'process';
import { PrismaClient, type Item } from '@mud/database';
import { env } from '../src/env';

console.log(`Env database URL: ${env.DATABASE_URL}`);

type SeedArgs = {
  tileSlug: string;
  tileName: string;
  catalogFile?: string;
  announcementsFile: string;
  coords?: string;
  arrivalMessage?: string;
  cooldownSeconds: number;
  populationLimit: number;
  reset: boolean;
};

type CatalogInput = {
  sku?: string;
  name: string;
  description?: string;
  buyPriceGold: number;
  sellPriceGold?: number;
  stockQuantity?: number;
  maxStock?: number;
  restockIntervalMinutes?: number;
  tags?: string[];
  isActive?: boolean;
  itemType?: string;
  slot?: string;
  attack?: number;
  defense?: number;
  healthBonus?: number;
};

type AnnouncementInput = {
  title: string;
  body: string;
  digest: string;
  priority?: number;
  visibleFrom?: string;
  visibleUntil?: string;
};

const prisma = new PrismaClient();

const parseArgs = (): SeedArgs => {
  const argv = process.argv.slice(2);
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.replace(/^--/, '');
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
        continue;
      }
      args[key] = next;
      i += 1;
    }
  }

  const tileSlug = (args.tile as string) ?? 'guild-hall';
  const tileName = (args.name as string) ?? 'Adventurers Guild Hall';
  const catalogFile = args.catalog as string | undefined;
  const announcementsFile = args.announcements as string;

  if (!announcementsFile) {
    throw new Error(
      '--announcements <file> is required when seeding guild data.',
    );
  }

  const cooldownSeconds = args.cooldown ? Number(args.cooldown) : 300;
  const populationLimit = args.population ? Number(args.population) : 50;

  if (Number.isNaN(cooldownSeconds) || Number.isNaN(populationLimit)) {
    throw new Error('--cooldown and --population must be numeric values.');
  }

  return {
    tileSlug,
    tileName,
    catalogFile,
    announcementsFile,
    coords: args.coords as string | undefined,
    arrivalMessage: args.arrival as string | undefined,
    cooldownSeconds,
    populationLimit,
    reset: Boolean(args.reset),
  };
};

const readJsonFile = <T>(filePath: string): T => {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Cannot find file at ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(raw) as T;
};

const parseCoords = (coords?: string, slug?: string) => {
  if (!coords) {
    return { slug: slug ?? 'guild-hall' };
  }
  const [x, y, z] = coords.split(',').map((value) => Number(value.trim()));
  if ([x, y, z].some((value) => Number.isNaN(value))) {
    throw new Error(
      `Invalid coords string: ${coords}. Expected format "x,y,z"`,
    );
  }
  return { x, y, z };
};

const seedGuildHall = async (args: SeedArgs) => {
  const tileCoordinates = parseCoords(args.coords, args.tileSlug);
  const arrivalMessage =
    args.arrivalMessage ??
    '✨ You arrive inside the Guild Hall. Merchants wave you over while the town crier rehearses the latest rumors.';

  const services = {
    shop: true,
    crier: true,
    exits: ['return', 'random'],
  };

  await prisma.guildHall.upsert({
    where: { slug: args.tileSlug },
    update: {
      displayName: args.tileName,
      tileCoordinates,
      populationLimit: args.populationLimit,
      services,
      teleportCooldownSeconds: args.cooldownSeconds,
      arrivalMessage,
    },
    create: {
      slug: args.tileSlug,
      displayName: args.tileName,
      tileCoordinates,
      populationLimit: args.populationLimit,
      services,
      teleportCooldownSeconds: args.cooldownSeconds,
      arrivalMessage,
    },
  });
};

const seedItemTemplates = async (
  items: CatalogInput[],
  reset: boolean,
): Promise<void> => {
  if (items.length === 0) return;
  if (reset) {
    await prisma.item.deleteMany({
      where: {
        name: { in: items.map((item) => item.name) },
      },
    });
  }

  for (const [index, item] of items.entries()) {
    const existing = await prisma.item.findFirst({
      where: { name: item.name },
    });
    if (existing) {
      continue;
    }
    await prisma.item.create({
      data: {
        name: item.name,
        type: (item.itemType as never) ?? 'weapon',
        description: item.description ?? '',
        value: Math.max(1, item.buyPriceGold),
        attack: item.attack ?? 0,
        defense: item.defense ?? 0,
        healthBonus: item.healthBonus ?? 0,
        slot: item.slot ? (item.slot as never) : null,
      },
    });
    if (index % 10 === 0) {
      console.log(`  ➤ Ensured item template: ${item.name}`);
    }
  }
};

const computeBuyPrice = (item: Item): number => {
  const base = Math.max(10, item.value ?? 0);
  const variance = Math.round(base * 0.25 * Math.random());
  return base + variance;
};

const computeSellPrice = (buyPrice: number): number =>
  Math.max(1, Math.floor(buyPrice * 0.5));

const computeStockQuantity = (): number =>
  Math.max(1, 2 + Math.floor(Math.random() * 4));

const seedInitialCatalogRotation = async (
  rotationSize: number,
): Promise<void> => {
  const items = await prisma.$queryRaw<Item[]>`
    SELECT *
    FROM "Item"
    WHERE "value" >= 0
    ORDER BY RANDOM()
    LIMIT ${Math.max(1, rotationSize)}
  `;
  if (!items.length) {
    console.warn(
      '⚠️  Skipping initial guild shop rotation - no items available.',
    );
    return;
  }

  await prisma.shopCatalogItem.createMany({
    data: items.map((item, index) => {
      const buyPrice = computeBuyPrice(item);
      const stockQuantity = computeStockQuantity();
      return {
        sku: `seed-${item.id}-${Date.now()}-${index}`,
        name: item.name,
        description: item.description ?? '',
        buyPriceGold: buyPrice,
        sellPriceGold: computeSellPrice(buyPrice),
        stockQuantity,
        maxStock: stockQuantity,
        restockIntervalMinutes: Math.floor(
          env.GUILD_SHOP_ROTATION_INTERVAL_MS / 60_000,
        ),
        tags: item.type ? [item.type] : [],
        isActive: true,
        itemTemplateId: item.id,
      };
    }),
  });
};

const seedAnnouncements = async (
  entries: AnnouncementInput[],
  reset: boolean,
) => {
  if (reset) {
    await prisma.announcementRecord.deleteMany();
  }

  if (entries.length === 0) return;

  await prisma.announcementRecord.createMany({
    data: entries.map((announcement) => ({
      title: announcement.title,
      body: announcement.body,
      digest: announcement.digest,
      priority: announcement.priority ?? 0,
      visibleFrom: announcement.visibleFrom
        ? new Date(announcement.visibleFrom)
        : new Date(),
      visibleUntil: announcement.visibleUntil
        ? new Date(announcement.visibleUntil)
        : null,
    })),
    skipDuplicates: true,
  });
};

(async () => {
  try {
    const args = parseArgs();
    const catalog = args.catalogFile
      ? readJsonFile<CatalogInput[]>(args.catalogFile)
      : [];
    const announcements = readJsonFile<AnnouncementInput[]>(
      args.announcementsFile,
    );

    await seedGuildHall(args);
    if (catalog.length > 0) {
      await seedItemTemplates(catalog, args.reset);
    }
    await seedAnnouncements(announcements, args.reset);
    if (args.reset) {
      await prisma.transactionReceipt.deleteMany();
      await prisma.shopCatalogItem.deleteMany();
    }
    await seedInitialCatalogRotation(env.GUILD_SHOP_ROTATION_SIZE);

    console.log(
      `✅ Seeded guild hall (${args.tileSlug}) with ${catalog.length} template items and ${announcements.length} announcements`,
    );
  } catch (error) {
    console.error('Guild seed failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
