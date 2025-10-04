/**
 * Backfill script to populate clientId and clientType for existing players
 * Run with: npx ts-node scripts/backfill-client-ids.ts
 */

import { getPrismaClient } from '../src';

async function backfillClientIds() {
  const prisma = getPrismaClient();

  console.log('🔄 Starting backfill of clientId and clientType...');

  // Find all players without clientId
  const players = await prisma.player.findMany({
    where: {
      OR: [{ clientId: null }, { clientType: null }],
    },
  });

  console.log(`📊 Found ${players.length} players to backfill`);

  if (players.length === 0) {
    console.log('✅ No players need backfilling!');
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const player of players) {
    try {
      // Skip if no slackId (shouldn't happen, but be safe)
      if (!player.slackId) {
        console.log(`⚠️  Player ${player.id} has no slackId, skipping...`);
        skipped++;
        continue;
      }

      await prisma.player.update({
        where: { id: player.id },
        data: {
          clientId: `slack:${player.slackId}`,
          clientType: 'slack',
        },
      });

      updated++;

      if (updated % 10 === 0) {
        console.log(`   Processed ${updated}/${players.length}...`);
      }
    } catch (error) {
      console.error(`❌ Error updating player ${player.id}:`, error);
    }
  }

  console.log(`\n✅ Backfill complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${players.length}`);
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
