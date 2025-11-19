import fs from 'fs';
import path from 'path';
import process from 'process';
import { PrismaClient } from '@mud/database';

type SeedArgs = {
  tileSlug: string;
  tileName: string;
  catalogFile: string;
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
  const catalogFile = args.catalog as string;
  const announcementsFile = args.announcements as string;

  if (!catalogFile || !announcementsFile) {
    throw new Error(
      'Both --catalog <file> and --announcements <file> are required when seeding guild data.',
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

const seedCatalog = async (items: CatalogInput[], reset: boolean) => {
  if (reset) {
    await prisma.transactionReceipt.deleteMany();
    await prisma.shopCatalogItem.deleteMany();
  }

  if (items.length === 0) return;

  await prisma.shopCatalogItem.createMany({
    data: items.map((item, index) => ({
      sku: item.sku ?? `guild-item-${index + 1}`,
      name: item.name,
      description: item.description ?? '',
      buyPriceGold: item.buyPriceGold,
      sellPriceGold: item.sellPriceGold ?? Math.floor(item.buyPriceGold / 2),
      stockQuantity: item.stockQuantity ?? 0,
      maxStock: item.maxStock ?? item.stockQuantity ?? 0,
      restockIntervalMinutes: item.restockIntervalMinutes ?? null,
      tags: item.tags ?? [],
      isActive: item.isActive ?? true,
    })),
    skipDuplicates: true,
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
    const catalog = readJsonFile<CatalogInput[]>(args.catalogFile);
    const announcements = readJsonFile<AnnouncementInput[]>(
      args.announcementsFile,
    );

    await seedGuildHall(args);
    await seedCatalog(catalog, args.reset);
    await seedAnnouncements(announcements, args.reset);

    console.log(
      `✅ Seeded guild hall (${args.tileSlug}) with ${catalog.length} catalog items and ${announcements.length} announcements`,
    );
  } catch (error) {
    console.error('Guild seed failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
