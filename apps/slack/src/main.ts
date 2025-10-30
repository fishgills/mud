// server.ts
import '@mud/tracer/register'; // must come before importing any instrumented module.
import { App } from '@slack/bolt';
import { env } from './env';
import { NotificationService } from './notification.service';
import { getPrismaClient } from '@mud/database';
import {
  authorize,
  invalidateAuthorizeCache,
  clearAllAuthorizeCache,
} from './utils/authorize';

import { PrismaInstallationStore } from '@seratch_/bolt-prisma';

// Decode any env values that were accidentally base64-encoded so the app
// always receives raw strings. We create `decodedEnv` from `env` and use it
// throughout the app.
const maybeDecodeBase64 = (v?: string): string | undefined => {
  if (!v) return v;
  const tryDecode = (input: string): string | null => {
    try {
      const decoded = Buffer.from(input, 'base64').toString('utf8');
      if (Buffer.from(decoded, 'utf8').toString('base64') === input) {
        return decoded;
      }
      return null;
    } catch {
      return null;
    }
  };

  const once = tryDecode(v);
  if (once !== null) {
    const twice = tryDecode(once);
    return twice !== null ? twice : once;
  }
  return v;
};

const decodedEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [
    k,
    typeof v === 'string' ? (maybeDecodeBase64(v) ?? v) : v,
  ]),
) as unknown as typeof env;

const installationStore = new PrismaInstallationStore({
  clientId: decodedEnv ? decodedEnv.SLACK_CLIENT_ID : env.SLACK_CLIENT_ID,
  prismaTable: getPrismaClient().slackAppInstallation,
  onFetchInstallation: async (args) => {
    console.log(
      `Installation fetched: ${args.installation.isEnterpriseInstall ? 'Enterprise' : 'Team'} ${
        args.installation.isEnterpriseInstall
          ? args.installation.enterprise?.id
          : args.installation.team?.id
      }`,
    );
  },
  onStoreInstallation: async (args) => {
    console.log(
      `Installation stored: ${args.installation.isEnterpriseInstall ? 'Enterprise' : 'Team'} ${
        args.installation.isEnterpriseInstall
          ? args.installation.enterprise?.id
          : args.installation.team?.id
      }`,
    );
    try {
      const teamId =
        args.installation.team?.id ?? args.installation.team?.id ?? null;
      const enterpriseId = args.installation.enterprise?.id ?? null;
      await invalidateAuthorizeCache(
        decodedEnv ? decodedEnv.SLACK_CLIENT_ID : env.SLACK_CLIENT_ID,
        teamId,
        enterpriseId,
      );
    } catch (err) {
      console.warn('Failed to invalidate authorize cache on store:', err);
    }
  },
  onDeleteInstallation: async (args) => {
    console.log(
      `Installation deleted: ${args.query.isEnterpriseInstall ? 'Enterprise' : 'Team'} ${
        args.query.isEnterpriseInstall
          ? args.query.enterpriseId
          : args.query.teamId
      }`,
    );
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const teamId = (args.query as any).teamId ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enterpriseId = (args.query as any).enterpriseId ?? null;
      await invalidateAuthorizeCache(
        decodedEnv ? decodedEnv.SLACK_CLIENT_ID : env.SLACK_CLIENT_ID,
        teamId,
        enterpriseId,
      );
    } catch (err) {
      console.warn('Failed to invalidate authorize cache on delete:', err);
    }
  },
});

// authorize is implemented in src/utils/authorize.ts and imported above.

const app = new App({
  // token: env.SLACK_BOT_TOKEN,
  signingSecret: decodedEnv.SLACK_SIGNING_SECRET,
  socketMode: false,
  // OAuth (optional): if clientId/clientSecret/stateSecret are provided, installer is enabled
  // clientId: decodedEnv.SLACK_CLIENT_ID,
  // clientSecret: decodedEnv.SLACK_CLIENT_SECRET,
  // stateSecret: decodedEnv.SLACK_STATE_SECRET,
  scopes: [
    'app_mentions:read',
    'chat:write',
    'channels:read',
    'im:history',
    'im:read',
    'im:write',
    'users:read',
  ],
  installerOptions: {
    directInstall: true,
  },
  installationStore: installationStore,
  // Per-request authorization resolver that returns the correct token set
  // based on the incoming event's teamId/enterpriseId.
  authorize,
  customRoutes: [
    {
      path: '/health-check',
      method: 'GET',
      handler: async (_req, res) => {
        res.writeHead(200);
        res.end('OK');
      },
    },
  ],
});

// No-op: cloud-run specific auth helper removed for GKE-only deployments. Use platform
// native credentials/auth where necessary. Previously this called `setAuthLogger(...)`.

// Absorb ACME HTTP-01 challenge probes from Google-managed certs for domain mappings.
// These requests look like: /.well-known/acme-challenge/<token>
// We respond 204 to avoid noisy logs and keep it fast. No payload needed.
// Bolt uses an Express receiver by default when not using Socket Mode, so we can attach routes.
type ResLite = { status: (code: number) => { send: (body?: string) => void } };
type RouterLite = {
  get: (path: string, handler: (req: unknown, res: ResLite) => void) => void;
};
type ReceiverWithRouter = { router?: RouterLite };
const receiver = (app as unknown as { receiver?: ReceiverWithRouter }).receiver;
if (receiver?.router) {
  receiver.router.get('/.well-known/acme-challenge/:token', (_req, res) => {
    res.status(204).send('');
  });
  receiver.router.get('/.well-known/*', (_req, res) => {
    res.status(204).send('');
  });
}

import './handlers/move';
import './handlers/look';
import './handlers/attack';
import './handlers/sniff';
import './handlers/create';
import './handlers/reroll';
import './handlers/complete';
import './handlers/delete';
import './handlers/map';
import './handlers/stats';
import './handlers/inventory';
import './handlers/pickup';
import './handlers/drop';
import './handlers/equip';
import { getAllHandlers } from './handlers/handlerRegistry';
import { COMMANDS } from './commands';
import { registerActions } from './actions';
import { SayMessage } from './handlers/types';
import { registerAppHome } from './handlers/appHome';

app.event('app_mention', async ({ event, say }) => {
  await say(
    `Hello <@${event.user}>! Welcome to the MUD adventure! 🎮

**Quick Start:**
• DM me "${COMMANDS.NEW} YourName" to create a character
• Use "${COMMANDS.REROLL}" to reroll stats during creation  
• Use "${COMMANDS.COMPLETE}" to complete character creation
• Use "${COMMANDS.DELETE}" to delete character during creation

**Once you have a character:**
• Move with "${COMMANDS.NORTH}", "${COMMANDS.SOUTH}", "${COMMANDS.EAST}", "${COMMANDS.WEST}", "${COMMANDS.UP}", "${COMMANDS.DOWN}", "${COMMANDS.LEFT}", "${COMMANDS.RIGHT}"
• Attack monsters with "${COMMANDS.ATTACK}"
• Sniff out nearby monsters with "${COMMANDS.SNIFF}"
• Check stats with "${COMMANDS.STATS}"
• View map with "${COMMANDS.MAP}"
• Check inventory with "${COMMANDS.INVENTORY}"

💡 **Send me "${COMMANDS.HELP}" for the full command list!**`,
  );
});

registerAppHome(app);

app.message(async ({ message, say, client }) => {
  // Only handle direct user messages (not message_changed, etc)
  if (
    message.type !== 'message' ||
    ('subtype' in message && message.subtype !== undefined) ||
    ('channel_type' in message ? message.channel_type !== 'im' : true)
  ) {
    return;
  }
  const text =
    'text' in message && typeof message.text === 'string'
      ? message.text.trim()
      : '';
  const userId = 'user' in message ? message.user : undefined;
  if (!text || !userId) return;

  // Dispatch to the first matching handler (case-insensitive)
  // Wrap say so handlers can send text, Block Kit, or upload a file
  const sayVoid = async (msg: SayMessage) => {
    if ('fileUpload' in msg && msg.fileUpload) {
      const dm = await app.client.conversations.open({ users: userId });
      const channelId = dm.channel?.id as string | undefined;
      if (!channelId) return;
      const buffer = Buffer.from(msg.fileUpload.contentBase64, 'base64');
      await app.client.files.uploadV2({
        channel_id: channelId,
        filename: msg.fileUpload.filename,
        file: buffer,
        initial_comment: msg.text,
      });
      return;
    }
    const { text, blocks } = msg;
    if (blocks && Array.isArray(blocks) && blocks.length > 0) {
      await say({ text: text ?? '', blocks });
    } else {
      await say(text ?? '');
    }
  };

  const lowerText = text.toLowerCase();
  for (const [key, handler] of Object.entries(getAllHandlers())) {
    // Check if the message starts with the command or contains it as a whole word
    console.log(`Checking handler for command: ${key}`);
    if (
      lowerText === key.toLowerCase() ||
      lowerText.startsWith(key.toLowerCase() + ' ') ||
      lowerText.includes(' ' + key.toLowerCase() + ' ') ||
      lowerText.endsWith(' ' + key.toLowerCase())
    ) {
      console.log(`Dispatching to handler for: ${key}`);
      // Minimal resolver: supports <@U123> mentions already parsed by Slack. Advanced username lookup would require Web API users.list which we avoid here.
      const resolveUserId = async (nameOrMention: string) => {
        const m = nameOrMention.trim().match(/^<@([A-Z0-9]+)>$/i);
        return m ? m[1] : undefined;
      };
      await handler({ userId, say: sayVoid, text, resolveUserId, client });
      return;
    }
  }
  console.log(`No handler found for message: "${text}" from user ${userId}`);

  // Help message for unknown input
  await say(
    `Hi <@${userId}>! I didn't understand that command. Here are the main commands:

🎮 **Character Creation:**
• "${COMMANDS.NEW} CharacterName" - Create a new character
• "${COMMANDS.REROLL}" - Reroll your stats during creation
• "${COMMANDS.COMPLETE}" - Complete character creation

🏃 **Movement:**
• "${COMMANDS.NORTH}", "${COMMANDS.SOUTH}", "${COMMANDS.EAST}", "${COMMANDS.WEST}" - Move using directions
• "${COMMANDS.UP}", "${COMMANDS.DOWN}", "${COMMANDS.LEFT}", "${COMMANDS.RIGHT}" - Alternative direction words

⚔️ **Actions:**
• "${COMMANDS.ATTACK}" - Attack nearby monsters
• "${COMMANDS.SNIFF}" - Sniff for nearby monsters
• "${COMMANDS.STATS}" - View your character stats

📋 **Other:**
• "${COMMANDS.HELP}" - Show full command list
• "${COMMANDS.MAP}" - View the world map
• "${COMMANDS.INVENTORY}" - See your equipped gear

💡 **New here?** Start with "${COMMANDS.NEW} YourName" to create your character!`,
  );
});

// Centralize all Slack actions and view handlers
registerActions(app);

async function start() {
  // Clear any existing authorize cache on startup so we start with a clean slate.
  try {
    await clearAllAuthorizeCache();
  } catch (err) {
    console.warn('Failed to clear authorize cache on startup:', err);
  }
  await app.start(Number(decodedEnv.PORT ?? env.PORT));
  console.log(
    `⚡️ Slack MUD bot is running! 🚀 On http://localhost:${env.PORT}`,
  );

  // Start notification service to receive game events
  const notificationService = new NotificationService();
  await notificationService.start();
}

start();
