import { App, LogLevel } from '@slack/bolt';
import { env } from './env';

const app = new App({
  token: env.SLACK_BOT_TOKEN,
  // signingSecret: env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.DEBUG,
  socketMode: true,
  appToken: env.SLACK_APP_TOKEN,
});

import './handlers/move';
import './handlers/look';
import './handlers/attack';
import './handlers/create';
import './handlers/reroll';
import './handlers/complete';
import './handlers/delete';
import './handlers/help';
import './handlers/map';
import './handlers/stats';
import { getAllHandlers } from './handlers/handlerRegistry';
import { COMMANDS, HELP_ACTIONS } from './commands';

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
• Check stats with "${COMMANDS.STATS}"
• View map with "${COMMANDS.MAP}"

💡 **Send me "${COMMANDS.HELP}" for the full command list!**`,
  );
});

app.message(async ({ message, say }) => {
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
  // Wrap say so handlers can send text or Block Kit messages
  const sayVoid = async (msg: { text?: string; blocks?: any[] }) => {
    await say(msg as any);
  };

  const lowerText = text.toLowerCase();
  for (const [key, handler] of Object.entries(getAllHandlers())) {
    console.log(`Checking handler for: ${key}`);
    // Check if the message starts with the command or contains it as a whole word
    if (
      lowerText === key.toLowerCase() ||
      lowerText.startsWith(key.toLowerCase() + ' ') ||
      lowerText.includes(' ' + key.toLowerCase() + ' ') ||
      lowerText.endsWith(' ' + key.toLowerCase())
    ) {
      await handler({ userId, say: sayVoid, text });
      return;
    }
  }

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
• "${COMMANDS.STATS}" - View your character stats

📋 **Other:**
• "${COMMANDS.HELP}" - Show full command list
• "${COMMANDS.MAP}" - View the world map

💡 **New here?** Start with "${COMMANDS.NEW} YourName" to create your character!`,
  );
});

// Helper to run an existing text command handler from a button click
async function dispatchCommandViaDM(
  client: any,
  userId: string,
  command: string,
) {
  const handler = getAllHandlers()[command];
  if (!handler) return;
  const dm = await client.conversations.open({ users: userId });
  const channel = dm.channel?.id as string;
  if (!channel) return;
  const say = (msg: { text?: string; blocks?: any[] }) =>
    client.chat.postMessage({ channel, ...(msg as any) } as any) as any;
  await handler({ userId, text: command, say });
}

// Handle interactive actions from Block Kit (e.g., help buttons)
app.action(HELP_ACTIONS.LOOK, async ({ ack, body, client }) => {
  await ack();
  const userId = (body as any).user?.id as string;
  if (!userId) return;
  await dispatchCommandViaDM(client, userId, COMMANDS.LOOK);
});

app.action(HELP_ACTIONS.STATS, async ({ ack, body, client }) => {
  await ack();
  const userId = (body as any).user?.id as string;
  if (!userId) return;
  await dispatchCommandViaDM(client, userId, COMMANDS.STATS);
});

app.action(HELP_ACTIONS.MAP, async ({ ack, body, client }) => {
  await ack();
  const userId = (body as any).user?.id as string;
  if (!userId) return;
  await dispatchCommandViaDM(client, userId, COMMANDS.MAP);
});

// Create button: open a modal to capture character name
app.action(HELP_ACTIONS.CREATE, async ({ ack, body, client }) => {
  await ack();
  const trigger_id = (body as any).trigger_id as string;
  try {
    await client.views.open({
      trigger_id,
      view: {
        type: 'modal',
        callback_id: 'create_character_view',
        title: { type: 'plain_text', text: 'Create Character' },
        submit: { type: 'plain_text', text: 'Create' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input',
            block_id: 'create_name_block',
            label: { type: 'plain_text', text: 'Character name' },
            element: {
              type: 'plain_text_input',
              action_id: 'character_name',
              placeholder: { type: 'plain_text', text: 'e.g., AwesomeDude' },
            },
          },
        ],
      },
    });
  } catch (e) {
    // Fallback: DM prompt if opening modal fails (e.g., missing views:write scope)
    const userId = (body as any).user?.id as string;
    if (!userId) return;
    const dm = await client.conversations.open({ users: userId });
    const channel = dm.channel?.id as string;
    if (!channel) return;
    await client.chat.postMessage({
      channel,
      text: 'To create a character, type: `new YourName`',
    });
  }
});

// Handle the Create Character modal submission
app.view('create_character_view', async ({ ack, body, client }) => {
  const values = (body as any).view?.state?.values as any;
  const name = values?.create_name_block?.character_name?.value?.trim();

  if (!name) {
    await ack({
      response_action: 'errors',
      errors: { create_name_block: 'Please enter a character name.' },
    } as any);
    return;
  }

  await ack();

  const userId = (body as any).user?.id as string;
  if (!userId) return;
  const handler = getAllHandlers()[COMMANDS.NEW];
  if (!handler) return;
  const dm = await client.conversations.open({ users: userId });
  const channel = dm.channel?.id as string;
  if (!channel) return;
  const say = (msg: { text?: string; blocks?: any[] }) =>
    client.chat.postMessage({ channel, ...(msg as any) } as any) as any;
  // Invoke existing create flow with text command shape
  await handler({ userId, text: `${COMMANDS.NEW} ${name}`, say });
});

async function start() {
  await app.start(Number(env.PORT));
  console.log(
    `⚡️ Slack MUD bot is running! 🚀 On http://localhost:${env.PORT}`,
  );
}

start();
