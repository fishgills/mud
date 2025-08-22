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

app.event('app_mention', async ({ event, say }) => {
  await say(
    `Hello <@${event.user}>! Welcome to the MUD adventure! 🎮

**Quick Start:**
• DM me ":new: YourName" to create a character
• Use ":game_die:" to reroll stats during creation  
• Use ":white_check_mark:" to complete character creation
• Use ":wastebasket:" to delete character during creation

**Once you have a character:**
• Move with ⬆️ ⬇️ ⬅️ ➡️ or "north", "south", etc.
• Attack monsters with ⚔️
• Check stats with ":bar_chart:"
• View map with ":map:"

💡 **Send me "help" for the full command list!**`,
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

  // Dispatch to the first matching handler (emoji or word, case-insensitive)
  // Wrap say so it matches the expected return type (Promise<void>)
  const sayVoid = async (msg: { text: string }) => {
    await say(msg);
  };

  const lowerText = text.toLowerCase();
  for (const [key, handler] of Object.entries(getAllHandlers())) {
    console.log(`Checking handler for: ${key}`);
    if (lowerText.includes(key.toLowerCase())) {
      await handler({ userId, say: sayVoid, text });
      return;
    }
  }

  // Help message for unknown input
  await say(
    `Hi <@${userId}>! I didn't understand that command. Here are the main commands:

🎮 **Character Creation:**
• :new: CharacterName - Create a new character
• :game_die: - Reroll your stats during creation
• :white_check_mark: - Complete character creation

🏃 **Movement:**
• ⬆️ ⬇️ ⬅️ ➡️ - Move using arrow emojis
• "north", "south", "east", "west" - Move using words

⚔️ **Actions:**
• ⚔️ - Attack nearby monsters  
• :bar_chart: - View your character stats

📋 **Other:**
• "help" - Show full command list
• "map" - View the world map

💡 **New here?** Start with \`:new: YourName\` to create your character!`,
  );
});

async function start() {
  await app.start(Number(env.PORT));
  console.log(
    `⚡️ Slack MUD bot is running! 🚀 On http://localhost:${env.PORT}`,
  );
}

start();
