// server.ts
import '@mud/tracer/register'; // must come before importing any instrumented module.
import { App } from '@slack/bolt';
import { env } from './env';
import { getPrismaClient } from '@mud/database';
import { PrismaInstallationStore } from '@seratch_/bolt-prisma';
import { NotificationService } from './notification.service';
import { setSlackApp } from './appContext';

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
});

const app = new App({
  signingSecret: decodedEnv.SLACK_SIGNING_SECRET,
  socketMode: false,
  // OAuth (optional): if clientId/clientSecret/stateSecret are provided, installer is enabled
  clientId: decodedEnv.SLACK_CLIENT_ID,
  clientSecret: decodedEnv.SLACK_CLIENT_SECRET,
  stateSecret: decodedEnv.SLACK_STATE_SECRET,
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
setSlackApp(app);

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

app.message(async ({ message, say, client, context }) => {
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

  // Extract workspace team ID for multi-workspace support
  const teamId =
    typeof context.teamId === 'string' ? context.teamId : undefined;

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
    app.logger.debug({ command: key, userId, teamId }, 'Inspecting handler');
    if (
      lowerText === key.toLowerCase() ||
      lowerText.startsWith(key.toLowerCase() + ' ') ||
      lowerText.includes(' ' + key.toLowerCase() + ' ') ||
      lowerText.endsWith(' ' + key.toLowerCase())
    ) {
      app.logger.debug({ command: key, userId, teamId }, 'Dispatching handler');
      // Minimal resolver: supports both <@U123> and @username formats from Slack
      const resolveUserId = async (nameOrMention: string) => {
        app.logger.debug({ input: nameOrMention }, 'Resolve user ID input');
        // Try <@U123> format first
        const m = nameOrMention.trim().match(/^<@([A-Z0-9]+)>$/i);
        if (m) {
          const result = m[1];
          app.logger.debug({ result }, 'Resolve matched ID format');
          return result;
        }
        // If not ID format, it might be a plain username like @CharliTest or CharliTest
        // For now, we can't resolve usernames without calling Slack's users.list API
        // Just extract the username part if it looks like @username
        const usernameMatch = nameOrMention
          .trim()
          .match(/^@?([a-zA-Z0-9_.-]+)$/);
        if (usernameMatch) {
          app.logger.debug(
            { username: usernameMatch[1] },
            'Resolve matched username format but cannot resolve without API call',
          );
        }
        app.logger.debug('Resolve user ID: no match found');
        return undefined;
      };
      await handler({
        userId,
        say: sayVoid,
        text,
        resolveUserId,
        client,
        teamId: teamId!,
      });
      return;
    }
  }
  app.logger.debug({ userId, text }, 'No handler resolved');

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
  await app.start(Number(decodedEnv.PORT ?? env.PORT));
  app.logger.info({ port: env.PORT, host: '0.0.0.0' }, 'Slack MUD bot ready');

  // Start notification service to receive game events
  const notificationService = new NotificationService({
    installationStore,
    fallbackBotToken: decodedEnv.SLACK_BOT_TOKEN ?? env.SLACK_BOT_TOKEN ?? null,
    logger: app.logger,
  });
  await notificationService.start();
}

start();
