import { App, LogLevel } from '@slack/bolt';
import fetch from 'node-fetch';

// Load environment variables (SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, DM_API_URL, WORLD_API_URL)
const token = process.env.SLACK_BOT_TOKEN;
const signingSecret = process.env.SLACK_SIGNING_SECRET;
const dmApiUrl = process.env.DM_API_URL;
const worldApiUrl = process.env.WORLD_API_URL;

if (!token || !signingSecret || !dmApiUrl || !worldApiUrl) {
  throw new Error('Missing required environment variables.');
}

const app = new App({
  token,
  signingSecret,
  logLevel: LogLevel.INFO,
});

// --- Character state cache (in-memory, for demo; use persistent store for production) ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const characterState: Record<string, any> = {};

// --- Helper: GraphQL query to DM/World services ---
async function graphqlQuery(
  apiUrl: string,
  query: string,
  variables?: Record<string, unknown>,
) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

// --- Slack command: /create-character ---
app.command('/create-character', async ({ command, ack, say }) => {
  await ack();
  const userId = command.user_id;
  const now = Date.now();
  const state = characterState[userId] || {};

  // Throttle: allow reroll only every 60 seconds
  if (state.lastReroll && now - state.lastReroll < 60000 && !state.done) {
    const wait = Math.ceil((60000 - (now - state.lastReroll)) / 1000);
    await say(
      `You must wait ${wait} seconds before rerolling your stats again.`,
    );
    return;
  }

  // If already done, prevent further rerolls
  if (state.done) {
    await say(
      'Your character is already created and locked in. Use /stats to view.',
    );
    return;
  }

  // Generate random D&D stats (4d6 drop lowest, 6 times)
  function rollStat() {
    const rolls = Array.from({ length: 4 }, () => Math.ceil(Math.random() * 6));
    rolls.sort((a, b) => a - b);
    return rolls[1] + rolls[2] + rolls[3];
  }
  const stats = {
    STR: rollStat(),
    DEX: rollStat(),
    CON: rollStat(),
    INT: rollStat(),
    WIS: rollStat(),
    CHA: rollStat(),
  };

  // Save state
  characterState[userId] = {
    stats,
    lastReroll: now,
    done: false,
  };

  await say(
    `Your rolled stats:\n` +
      Object.entries(stats)
        .map(([k, v]) => `${k}: ${v}`)
        .join('  ') +
      `\nType /create-character done to lock in your stats, or /create-character to reroll (1 min cooldown).`,
  );
});

// Handle /create-character done
app.command('/create-character done', async ({ command, ack, say }) => {
  await ack();
  const userId = command.user_id;
  const userName = command.user_name || 'Adventurer';
  const state = characterState[userId];
  if (!state || state.done) {
    await say(
      'No pending character to lock in. Use /create-character to roll stats.',
    );
    return;
  }
  // Mark as done
  state.done = true;

  // Call DM GraphQL API to create character in backend
  const mutation = `
    mutation CreatePlayer($input: CreatePlayerInput!) {
      createPlayer(input: $input) {
        success
        message
        data {
          id
          slackId
          name
          x
          y
        }
      }
    }
  `;
  const variables = {
    input: {
      slackId: userId,
      name: userName,
      // Optionally, you could pass x/y or stats if backend supports
    },
  };
  try {
    const result = await graphqlQuery(dmApiUrl, mutation, variables);
    if (result?.data?.createPlayer?.success) {
      await say(
        'Character created and locked in! Use /stats to view your character.',
      );
    } else {
      await say(
        `Failed to create character: ${result?.data?.createPlayer?.message || 'Unknown error'}`,
      );
    }
  } catch (err) {
    await say('Error communicating with DM service. Please try again later.');
  }
});

// --- Slack command: /move ---
app.command('/move', async ({ command, ack, say }) => {
  await ack();
  const userId = command.user_id;
  const text = command.text.trim().toLowerCase();
  const validDirections = [
    'n',
    'north',
    's',
    'south',
    'e',
    'east',
    'w',
    'west',
  ];
  if (!text || !validDirections.includes(text)) {
    await say('Usage: /move <n|s|e|w> (or north, south, east, west)');
    return;
  }
  // Normalize direction to GraphQL enum
  let direction = '';
  if (text.startsWith('n')) direction = 'NORTH';
  else if (text.startsWith('s')) direction = 'SOUTH';
  else if (text.startsWith('e')) direction = 'EAST';
  else if (text.startsWith('w')) direction = 'WEST';

  // Call DM GraphQL API to move player
  const mutation = `
    mutation MovePlayer($slackId: String!, $input: MovePlayerInput!) {
      movePlayer(slackId: $slackId, input: $input) {
        success
        message
        data {
          player { x y }
          location { biomeName description }
          description
        }
      }
    }
  `;
  const variables = {
    slackId: userId,
    input: { direction },
  };
  try {
    const result = await graphqlQuery(dmApiUrl, mutation, variables);
    const move = result?.data?.movePlayer;
    if (!move?.success) {
      await say(`Move failed: ${move?.message || 'Unknown error'}`);
      return;
    }
    const loc = move.data?.location;
    const desc = move.data?.description;
    await say(
      `Moved ${text} to biome: *${loc?.biomeName || 'Unknown'}*\n` +
        (loc?.description ? `_${loc.description}_\n` : '') +
        (desc ? `*${desc}*` : ''),
    );
  } catch (err) {
    await say('Error moving character via DM service.');
  }
});

// --- Slack command: /attack ---
app.command('/attack', async ({ command, ack, say }) => {
  await ack();
  const userId = command.user_id;
  const text = command.text.trim();
  // Usage: /attack <monster|player> <targetId>
  const [targetTypeRaw, targetIdRaw] = text.split(/\s+/);
  if (!targetTypeRaw || !targetIdRaw) {
    await say('Usage: /attack <monster|player> <targetId>');
    return;
  }
  const targetType =
    targetTypeRaw.toLowerCase() === 'monster'
      ? 'MONSTER'
      : targetTypeRaw.toLowerCase() === 'player'
        ? 'PLAYER'
        : null;
  const targetId = parseInt(targetIdRaw, 10);
  if (!targetType || isNaN(targetId)) {
    await say('Usage: /attack <monster|player> <targetId>');
    return;
  }
  // Call DM GraphQL API to attack
  const mutation = `
    mutation Attack($slackId: String!, $input: AttackInput!) {
      attack(slackId: $slackId, input: $input) {
        success
        message
        data {
          damage
          attackerName
          defenderName
          defenderHp
          defenderMaxHp
          isDead
          xpGained
          message
        }
      }
    }
  `;
  const variables = {
    slackId: userId,
    input: { targetType, targetId },
  };
  try {
    const result = await graphqlQuery(dmApiUrl, mutation, variables);
    const attack = result?.data?.attack;
    if (!attack?.success) {
      await say(`Attack failed: ${attack?.message || 'Unknown error'}`);
      return;
    }
    const d = attack.data;
    await say(
      `*${d.attackerName}* attacked *${d.defenderName}* for ${d.damage} damage.\n` +
        `Defender HP: ${d.defenderHp}/${d.defenderMaxHp}  ${d.isDead ? '💀 Defender is dead!' : ''}\n` +
        (d.xpGained ? `XP Gained: ${d.xpGained}\n` : '') +
        (d.message ? d.message : ''),
    );
  } catch (err) {
    await say('Error attacking via DM service.');
  }
});

// --- Slack command: /stats ---
app.command('/stats', async ({ command, ack, say }) => {
  await ack();
  const userId = command.user_id;
  // Query DM GraphQL API for player stats
  const query = `
    query GetPlayerStats($slackId: String!) {
      getPlayerStats(slackId: $slackId) {
        player {
          name
          x
          y
          hp
          maxHp
          strength
          agility
          health
          gold
          xp
          level
          isAlive
        }
        strengthModifier
        agilityModifier
        healthModifier
        dodgeChance
        baseDamage
        armorClass
        xpForNextLevel
        xpProgress
        xpNeeded
      }
    }
  `;
  const variables = { slackId: userId };
  try {
    const result = await graphqlQuery(dmApiUrl, query, variables);
    const stats = result?.data?.getPlayerStats;
    if (!stats || !stats.player) {
      await say('No character found. Use /create-character to make one.');
      return;
    }
    const p = stats.player;
    await say(
      `*${p.name}* (Level ${p.level})\n` +
        `HP: ${p.hp}/${p.maxHp}  Gold: ${p.gold}  XP: ${p.xp}\n` +
        `STR: ${p.strength} (mod: ${stats.strengthModifier})  ` +
        `AGI: ${p.agility} (mod: ${stats.agilityModifier})  ` +
        `HEA: ${p.health} (mod: ${stats.healthModifier})\n` +
        `Dodge: ${stats.dodgeChance}%  AC: ${stats.armorClass}  Damage: ${stats.baseDamage}\n` +
        `XP for next level: ${stats.xpForNextLevel}  Progress: ${stats.xpProgress}  Needed: ${stats.xpNeeded}\n` +
        `Location: (${p.x}, ${p.y})  Alive: ${p.isAlive ? 'Yes' : 'No'}`,
    );
  } catch (err) {
    await say('Error fetching stats from DM service.');
  }
});

(async () => {
  await app.start(process.env.PORT ? Number(process.env.PORT) : 3000);
  console.log('⚡️ Slack Bolt app is running!');
})();
