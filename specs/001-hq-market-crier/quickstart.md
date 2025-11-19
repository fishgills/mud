# Quickstart – Guild Hall Market & Crier

## 1. Prerequisites

- Node.js 20+, Yarn 1.22+
- Slack app credentials configured via existing `.env.local` conventions (do **not** commit secrets)
- Invite the Slack bot to both a DM and a throwaway channel once `yarn serve` is running; guild commands are ignored when the bot is absent.
- Export `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, and `DATABASE_URL` in your shell session (never commit them).
- PostgreSQL + Redis instances available via `docker-compose` or shared dev cluster
- Datadog API key configured for tracing/logging (optional locally)

## 2. Start Services

```bash
yarn install
yarn serve            # spins up dm, slack, world, tick
```

- Confirm `logs/mud-combined.log` shows DM + Slack online.
- Ensure Slack bot is invited to a test channel or DM.

## 3. Seed Guild Data

```bash
# Seed guild hall tile + catalog + announcements
node apps/dm/scripts/seed-guild.js \
  --tile "guild-hall" \
  --catalog ./apps/dm/scripts/data/guild-catalog.json \
  --announcements ./apps/dm/scripts/data/guild-announcements.json \
  --coords "0,0,0" \
  --arrival "✨ Welcome back to the guild hall." \
  --reset
```

- Catalog and announcement fixtures live in `apps/dm/scripts/data` and can be copied or extended for feature work.
- The DM Docker entrypoint now runs the same seed command automatically during deployments (guarded by `GUILD_SEED_ENABLED`, `GUILD_SEED_CATALOG_PATH`, etc.), so production clusters stay consistent.
- Use `--reset` to clear previous catalog + announcement rows before inserting the provided fixtures.

## 4. Test `guild` Teleport Flow

1. In Slack, DM the bot `guild`.
2. Expect immediate acknowledgement followed by a DM describing the guild services.
3. Check `logs/mud-combined.log` for `teleport.guild` entry with `correlationId`.
4. Run integration test:

```bash
yarn turbo run test --filter=@mud/dm -- teleport-guild
./apps/dm/test-dm.sh guild-teleport
```

## 5. Test Shop Commands

1. While at the guild, issue `buy potion`.
2. Validate Slack receipt + gold balance update.
3. Issue `sell potion` to verify the reverse flow.
4. Run targeted tests:

```bash
yarn turbo run test --filter=@mud/dm -- shop
yarn workspace @mud/slack test -- commandHandlers
```

5. Confirm `TransactionReceipt` rows and EventBus messages exist in DB/logs.

## 6. Test Town Crier Automation

1. Insert a new announcement row via Prisma seed or SQL.
2. Run the guild-specific Jest suites to ensure scheduler/service/publisher logic fails before code changes:

```bash
./apps/dm/test-dm.sh guild-crier
```

3. Trigger the scheduler manually to exercise the Nest worker in real time:

```bash
yarn turbo run start --filter=@mud/dm -- --cron=town-crier
```

4. Observe Slack broadcasts (guild occupants receive Town Crier blocks, others get digest summaries) and confirm logs mention `guild.crier.formatted`.
5. Verify `last_announced_at` updated and duplicate runs skip the same message.

## 7. Full Test Suite & Lint

```bash
yarn test
yarn lint
yarn turbo run test --filter=@mud/dm -- apps/dm/test-dm.sh
```

Ensure suites covering teleport cooldowns, buy/sell math, and crier scheduling fail before code changes per constitution.

## 8. Observability Checklist

- Confirm structured logs include `correlationId`, `playerId`, `itemId`, `goldDelta`.
- Verify Datadog span `guild.command` is emitted for teleport + shop flows.
- Monitor Slack rate-limit logs; adjust backoff if `429` responses appear.

## 9. Next Steps

- Proceed to `/speckit.tasks` once plan review passes and guild-specific migrations/contracts are approved.
