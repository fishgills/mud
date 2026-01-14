# Quickstart – Guild Hall Market & Crier

## 1. Prerequisites

- Node.js 20+, Yarn 1.22+
- Slack app credentials configured via existing `.env.local` conventions (do **not** commit secrets)
- Invite the Slack bot to both a DM and a throwaway channel once `yarn serve` is running; commands like `guild`, `catalog`, and `inventory` are ignored when the bot is absent.
- Export `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, and `DATABASE_URL` in your shell session (never commit them).
- PostgreSQL + Redis instances available via `docker-compose` or shared dev cluster
- Datadog API key configured for tracing/logging (optional locally)

## 2. Start Services

```bash
yarn install
yarn serve            # spins up dm, slack, tick
```

- Confirm `logs/mud-combined.log` shows DM + Slack online.
- Ensure Slack bot is invited to a test channel or DM.

## 3. Guild Setup

- No database seeding is required; the guild hall is defined in code and there is only one destination.
- Shop rotation will populate catalog entries automatically at runtime from existing `Item` templates.

⚙️ **Guild Shop Rotation**

- A dedicated Nest worker (`GuildShopRotationService`) rotates six random catalog entries every 5 minutes, selecting from the global `Item` table.
- For faster testing you can force a manual rotation:

```bash
curl -X POST http://localhost:3000/dm/guild/shop/rotate
```

- Active catalog entries are the ones with `isActive = true` in `ShopCatalogItem`; older entries are archived so historical receipts still resolve.

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

1. While at the guild, issue `catalog` to see available items.
2. Use the catalog buttons to purchase items and confirm gold/inventory changes.
3. Open `inventory` while inside the guild and use the Sell buttons next to backpack items to offload loot.
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
