/**
 * Backfill and normalize client identifiers for existing players.
 *
 * This script ensures every player record has a canonical
 * `clientId` with a type prefix (e.g. `slack:TEAM:USER`) and a
 * matching `clientType`. It is now safe to run even after the
 * legacy `slackId` column has been removed.
 *
 * Run with: npx ts-node scripts/backfill-client-ids.ts
 */

import { getPrismaClient } from '../src';

type ClientType = 'slack' | 'discord' | 'web';

const KNOWN_TYPES: readonly ClientType[] = ['slack', 'discord', 'web'] as const;

const parseClientIdentifier = (
  raw: string | null,
): { id: string | null; type: ClientType | null } => {
  if (!raw) {
    return { id: null, type: null };
  }

  const segments = raw
    .split(':')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return { id: null, type: null };
  }

  const potentialType = segments[0] as ClientType;
  if (segments.length === 1 || !KNOWN_TYPES.includes(potentialType)) {
    return { id: segments.join(':'), type: null };
  }

  return {
    type: potentialType,
    id: segments.slice(1).join(':'),
  };
};

const normalizeClientIdentifier = (
  raw: string | null,
  fallbackType: ClientType = 'slack',
): { id: string | null; type: ClientType } => {
  const parsed = parseClientIdentifier(raw);
  const id = (parsed.id ?? raw ?? '').trim();
  const type = parsed.type ?? fallbackType;

  if (!id) {
    return { id: null, type };
  }

  return { id, type };
};

async function backfillClientIds() {
  const prisma = getPrismaClient();

  console.log('🔄 Starting client identifier normalization...');

  const candidates = await prisma.player.findMany({
    where: {
      OR: [
        { clientId: null },
        { clientId: { equals: '' } },
        { clientType: null },
      ],
    },
  });

  if (candidates.length === 0) {
    console.log(
      '✅ All player records already have normalized client identifiers.',
    );
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const player of candidates) {
    const normalized = normalizeClientIdentifier(
      player.clientId,
      (player.clientType as ClientType | null) ?? 'slack',
    );

    if (!normalized.id) {
      console.warn(
        `⚠️  Player ${player.id} is missing a client identifier entirely. Please update manually.`,
      );
      skipped += 1;
      continue;
    }

    const fullClientId = `${normalized.type}:${normalized.id}`;
    const updates: { clientId?: string; clientType?: ClientType } = {};

    if (player.clientId !== fullClientId) {
      updates.clientId = fullClientId;
    }

    if ((player.clientType as ClientType | null) !== normalized.type) {
      updates.clientType = normalized.type;
    }

    if (Object.keys(updates).length === 0) {
      skipped += 1;
      continue;
    }

    await prisma.player.update({
      where: { id: player.id },
      data: updates,
    });

    updated += 1;
    if (updated % 10 === 0) {
      console.log(`   Processed ${updated}/${candidates.length}...`);
    }
  }

  console.log(`\n✅ Normalization complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total candidates: ${candidates.length}`);
}

backfillClientIds()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
