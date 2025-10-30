import { getPrismaClient } from '@mud/database';
import { env } from '../env';
import { createClient, RedisClientType } from 'redis';
import { WebClient } from '@slack/web-api';
import { AuthorizeSourceData } from '@slack/bolt';

/**
 * Resolve Slack installation credentials for the incoming request source.
 *
 * The Bolt `authorize` hook may pass additional parameters; accept `any`
 * to remain compatible with Bolt's typings.
 *
 * @param source incoming request source provided by Bolt (teamId, enterpriseId)
 * @param clientIdFilter optional clientId to scope the lookup (defaults to env.SLACK_CLIENT_ID)
 */
export async function authorize(source: AuthorizeSourceData<boolean>) {
  const prisma = getPrismaClient();
  const teamId = source?.teamId ?? null;
  const enterpriseId = source?.enterpriseId ?? null;

  const clientId = env.SLACK_CLIENT_ID;

  const cacheId = enterpriseId ?? teamId ?? 'unknown';
  const cacheKey = makeCacheKey(clientId, cacheId);

  // Try to read from cache first (best-effort). If cache read fails, continue
  // to DB lookup.
  try {
    if (env.REDIS_URL) {
      if (!redisClient) {
        redisClient = createClient({ url: env.REDIS_URL }) as RedisClientType;
        redisClient.on('error', (err) => {
          console.warn('Redis error (authorize cache):', err);
        });
        // Connect lazily and don't block authorization on connect failures
        redisClient.connect().catch((err) => {
          console.warn('Redis connect failed for authorize cache (get):', err);
        });
      }
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return JSON.parse(cached) as any;
        } catch {
          // ignore parse errors and fall back to DB
        }
      }
    }
  } catch (err) {
    console.warn('Authorize cache get failed:', err);
  }

  let install = null as unknown as Awaited<
    ReturnType<typeof prisma.slackAppInstallation.findFirst>
  >;

  if (enterpriseId) {
    install = await prisma.slackAppInstallation.findFirst({
      where: {
        enterpriseId: enterpriseId,
        clientId: clientId,
      },
      orderBy: { installedAt: 'desc' },
    });
  }

  if (!install && teamId) {
    install = await prisma.slackAppInstallation.findFirst({
      where: {
        teamId: teamId,
        clientId: clientId,
      },
      orderBy: { installedAt: 'desc' },
    });
  }

  if (!install) {
    throw new Error(
      `No matching Slack installation found for teamId=${teamId} enterpriseId=${enterpriseId}`,
    );
  }

  console.log(
    `✅ Resolved Slack installation for teamId=${teamId} enterpriseId=${enterpriseId}: botId=${install.botId} botUserId=${install.botUserId} botToken=${install.botToken?.slice(0, 5)}...`,
  );
  const result = {
    botToken: install.botToken ?? undefined,
    botId: install.botId ?? undefined,
    botUserId: install.botUserId ?? undefined,
    // userToken: install.userToken ?? undefined,
    // enterpriseId: install.enterpriseId ?? undefined,
    // teamId: install.teamId ?? undefined,
    // isEnterpriseInstall: install.isEnterpriseInstall ?? false,
  };

  // Try to cache the resolved installation in Redis for a short TTL to avoid
  // repeated DB hits. Cache key includes clientId and either enterpriseId or teamId.
  try {
    if (env.REDIS_URL) {
      // lazy-create client singleton
      if (!redisClient) {
        redisClient = createClient({ url: env.REDIS_URL }) as RedisClientType;
        // non-blocking connect
        redisClient.connect().catch((err) => {
          // ignore connect errors; caching is best-effort
          console.warn('Redis connect failed for authorize cache:', err);
        });
      }
      // Set TTL to 5 minutes (300000 ms)
      await redisClient.set(cacheKey, JSON.stringify(result), { PX: 300000 });
    }
  } catch (err) {
    // best-effort caching: swallow errors so authorization still works
    console.warn('Authorize cache set failed:', err);
  }

  return result;
}

// ----------------- Redis cache helpers -----------------
let redisClient: RedisClientType | null = null;
const CACHE_PREFIX = 'slack:authorize:';

function makeCacheKey(clientId: string, id: string) {
  return `${CACHE_PREFIX}${clientId}:${id}`;
}

/**
 * Resolve bot credentials for a specific Slack user ID. This mirrors
 * the PrismaInstallationStore.fetchInstallation behavior when queried by userId:
 * it attempts to return the user token (if present) merged with the latest
 * bot credentials for the same client/team/enterprise context.
 */
export async function getCredentialsForSlackUser(
  slackUserId: string,
): Promise<{ botToken?: string; botId?: string; botUserId?: string } | null> {
  const prisma = getPrismaClient();
  const clientId = env.SLACK_CLIENT_ID;

  // Try user-scoped cache first
  try {
    const client = await ensureRedis();
    if (client) {
      const key = `${CACHE_PREFIX}user:${clientId}:${slackUserId}`;
      const cached = await client.get(key);
      if (cached) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return JSON.parse(cached) as any;
        } catch {
          // fall through to DB lookup
        }
      }
    }
  } catch {
    // ignore cache errors
  }

  const userRow = await prisma.slackAppInstallation.findFirst({
    where: { clientId: clientId, userId: slackUserId },
    orderBy: { installedAt: 'desc' },
  });

  // If no user-scoped row found, try to find a bot row that may correspond
  // to the user's workspace by searching for an installation that contains
  // the same teamId/enterpriseId as the user. If we don't have userRow, we
  // cannot infer team/enterprise so bail.
  if (!userRow) return null;

  // Try to find the latest bot installation for the same context
  const botRow = await prisma.slackAppInstallation.findFirst({
    where: {
      clientId: clientId,
      enterpriseId: userRow.enterpriseId ?? null,
      teamId: userRow.teamId ?? null,
    },
    orderBy: { installedAt: 'desc' },
  });

  const merged = botRow
    ? {
        botToken: botRow.botToken ?? undefined,
        botId: botRow.botId ?? undefined,
        botUserId: botRow.botUserId ?? undefined,
      }
    : {
        botToken: userRow.botToken ?? undefined,
        botId: userRow.botId ?? undefined,
        botUserId: userRow.botUserId ?? undefined,
      };

  // Cache result keyed by user id to speed subsequent resolves
  try {
    const client = await ensureRedis();
    if (client) {
      const key = `${CACHE_PREFIX}user:${clientId}:${slackUserId}`;
      await client.set(key, JSON.stringify(merged), { PX: 300000 });
    }
  } catch {
    // ignore
  }

  return merged;
}

// ----------------- WebClient cache -----------------
const webClientMap = new Map<string, WebClient>();

/**
 * Return a cached WebClient for the provided bot token. Creating many
 * WebClient instances is relatively cheap but caching avoids repeated
 * allocations and lets us reuse underlying HTTP agent state.
 */
export function getWebClientForToken(token: string): WebClient {
  const existing = webClientMap.get(token);
  if (existing) return existing;
  const client = new WebClient(token, { slackApiUrl: undefined });
  webClientMap.set(token, client);
  return client;
}

async function ensureRedis(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) return null;
  if (!redisClient) {
    redisClient = createClient({ url: env.REDIS_URL }) as RedisClientType;
    redisClient.on('error', (err) => {
      console.warn('Redis error (authorize cache):', err);
    });
    // Connect but don't throw to keep caching best-effort
    try {
      // Connect asynchronously; don't await so we don't block authorization.
      // Any connection error will be emitted to the 'error' handler above.
      void redisClient.connect();
    } catch (err) {
      console.warn('Redis connect failed (authorize cache):', err);
      // leave redisClient assigned; operations will attempt and may fail
    }
  }
  return redisClient;
}

/**
 * Invalidate cache entries for a given client/enterprise/team.
 * If both enterpriseId and teamId are provided, both keys are removed.
 */
export async function invalidateAuthorizeCache(
  clientId?: string,
  teamId?: string | null,
  enterpriseId?: string | null,
) {
  const cid = clientId ?? env.SLACK_CLIENT_ID;
  const client = await ensureRedis();
  if (!client) return;
  const keys: string[] = [];
  if (enterpriseId) keys.push(makeCacheKey(cid, enterpriseId));
  if (teamId) keys.push(makeCacheKey(cid, teamId));
  // Also remove generic unknown key if present
  keys.push(makeCacheKey(cid, 'unknown'));
  try {
    if (keys.length > 0) await client.del(keys);
  } catch (err) {
    console.warn('Failed to invalidate authorize cache:', err);
  }
}

/**
 * Clear all authorize cache entries for all clients.
 * Used on service startup to ensure a clean slate.
 */
export async function clearAllAuthorizeCache(): Promise<void> {
  const client = await ensureRedis();
  if (!client) return;
  try {
    const pattern = `${CACHE_PREFIX}*`;
    const toDelete: string[] = [];
    for await (const k of client.scanIterator({
      MATCH: pattern,
      COUNT: 1000,
    })) {
      if (Array.isArray(k)) {
        toDelete.push(...k.map(String));
      } else {
        toDelete.push(String(k));
      }
      if (toDelete.length >= 500) {
        await client.del(toDelete.splice(0, toDelete.length));
      }
    }
    if (toDelete.length > 0) await client.del(toDelete);
  } catch (err) {
    console.warn('Failed to clear authorize cache:', err);
  }
}
