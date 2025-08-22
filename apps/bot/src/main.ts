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
• DM me "new YourName" to create a character
• Use "reroll" to reroll stats during creation  
• Use "complete" to complete character creation
• Use "delete" to delete character during creation

**Once you have a character:**
• Move with "north", "south", "east", "west", "up", "down", "left", "right"
• Attack monsters with "attack"
• Check stats with "stats"
• View map with "map"

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
• "new CharacterName" - Create a new character
• "reroll" - Reroll your stats during creation
• "complete" - Complete character creation

🏃 **Movement:**
• "north", "south", "east", "west" - Move using directions
• "up", "down", "left", "right" - Alternative direction words

⚔️ **Actions:**
• "attack" - Attack nearby monsters  
• "stats" - View your character stats

📋 **Other:**
• "help" - Show full command list
• "map" - View the world map

💡 **New here?** Start with "new YourName" to create your character!`,
  );
});

async function start() {
  await app.start(Number(env.PORT));
  console.log(
    `⚡️ Slack MUD bot is running! 🚀 On http://localhost:${env.PORT}`,
  );
}

start();
