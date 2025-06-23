import { App, LogLevel } from '@slack/bolt';

import { env } from './env';
import { dmSdk } from './gql-client';

const app = new App({
  token: env.SLACK_BOT_TOKEN,
  signingSecret: env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.INFO,
});

app.event('app_mention', async ({ event, say }) => {
  await say(
    `Hello <@${event.user}>! I am your MUD bot. Type /create to start your adventure!`,
  );
});

app.command('/create', async ({ command, ack, respond }) => {
  await ack();
  try {
    const name = command.user_name || `Player_${command.user_id}`;
    const input = { slackId: command.user_id, name };
    const result = await dmSdk.CreatePlayer({ input });
    if (result.createPlayer.success) {
      await respond({
        text: `Welcome <@${command.user_id}>! Your character creation has started. Use /reroll to reroll your stats, and /complete when you are done.`,
        response_type: 'ephemeral',
      });
    } else {
      await respond({
        text: `Error: ${result.createPlayer.message}`,
        response_type: 'ephemeral',
      });
    }
  } catch (err) {
    await respond({
      text: `Failed to create character: ${err}`,
      response_type: 'ephemeral',
    });
  }
});

app.command('/reroll', async ({ command, ack, respond }) => {
  await ack();
  try {
    const result = await dmSdk.RerollPlayerStats({ slackId: command.user_id });
    if (result.updatePlayerStats.success) {
      const stats = result.updatePlayerStats.data;
      await respond({
        text: `Rerolled stats for <@${command.user_id}>: Strength: ${stats?.strength}, Agility: ${stats?.agility}, Health: ${stats?.health}`,
        response_type: 'ephemeral',
      });
    } else {
      await respond({
        text: `Error: ${result.updatePlayerStats.message}`,
        response_type: 'ephemeral',
      });
    }
  } catch (err) {
    await respond({
      text: `Failed to reroll stats: ${err}`,
      response_type: 'ephemeral',
    });
  }
});

app.command('/complete', async ({ command, ack, respond }) => {
  await ack();
  try {
    const result = await dmSdk.CompletePlayer({ slackId: command.user_id });
    if (result.updatePlayerStats.success) {
      await respond({
        text: `Character creation complete for <@${command.user_id}>! You can now move and attack.`,
        response_type: 'ephemeral',
      });
    } else {
      await respond({
        text: `Error: ${result.updatePlayerStats.message}`,
        response_type: 'ephemeral',
      });
    }
  } catch (err) {
    await respond({
      text: `Failed to complete character: ${err}`,
      response_type: 'ephemeral',
    });
  }
});

async function start() {
  await app.start(Number(env.PORT));
  console.log('⚡️ Slack MUD bot is running!');
}

start();
