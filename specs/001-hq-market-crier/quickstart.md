# Quickstart – Guild Hall Market & Crier

## 1. Prerequisites

- Node.js 20+, Yarn 1.22+
- Slack app credentials configured via existing `.env.local` conventions (do **not** commit secrets)
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
  --catalog ./data/guild-catalog.json \
  --announcements ./data/guild-announcements.json
```

- Catalog file must include `name`, `buy_price_gold`, `sell_price_gold`, `stock_quantity` per entry.
- Announcements file lists `title`, `body`, `digest`, `priority`, `visible_from`.

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
yarn turbo run test --filter=@mud/slack -- guild-commands
```

5. Confirm `TransactionReceipt` rows and EventBus messages exist in DB/logs.

## 6. Test Town Crier Automation

1. Insert a new announcement row via Prisma seed or SQL.
2. Trigger the scheduler manually:

```bash
yarn turbo run start --filter=@mud/dm -- --cron=town-crier
```

3. Observe Slack broadcast in the guild channel and digest DMs elsewhere.
4. Verify `last_announced_at` updated and duplicate runs skip the same message.

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
