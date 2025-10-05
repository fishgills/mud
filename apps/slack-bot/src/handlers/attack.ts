import type { AttackMutation } from '../generated/dm-graphql';
import { TargetType } from '../generated/dm-graphql';
import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS, ATTACK_ACTIONS } from '../commands';
import { toClientId } from '../utils/clientId';

const MONSTER_SELECTION_BLOCK_ID = 'attack_monster_selection_block';

type AttackCombatResult = NonNullable<
  NonNullable<AttackMutation['attack']['data']>
>;

type NearbyMonster = { id: string; name: string };
type NearbyPlayer = { slackId: string; name: string };

export function buildTargetSelectionMessage(
  monsters: NearbyMonster[],
  players: NearbyPlayer[],
) {
  const monsterList = monsters.map((m) => m.name).join(', ');
  const playerList = players.map((p) => p.name).join(', ');
  const anyMonsters = monsters.length > 0;
  const anyPlayers = players.length > 0;

  const options = [
    ...players.map((p) => ({
      text: {
        type: 'plain_text' as const,
        text: `Player: ${p.name}`,
        emoji: true,
      },
      value: `P:${p.slackId}`,
    })),
    ...monsters.map((m) => ({
      text: {
        type: 'plain_text' as const,
        text: `Monster: ${m.name}`,
        emoji: true,
      },
      value: `M:${m.id}`,
    })),
  ];

  const firstOption = options[0];

  const headerParts: string[] = [];
  if (anyPlayers) headerParts.push(`players: ${playerList}`);
  if (anyMonsters) headerParts.push(`monsters: ${monsterList}`);
  const headerText = headerParts.length
    ? `You see the following at your location — ${headerParts.join(' | ')}`
    : 'Choose a target to attack:';

  return {
    text: 'Choose a target to attack',
    blocks: [
      {
        type: 'section' as const,
        text: { type: 'mrkdwn' as const, text: headerText },
      },
      {
        type: 'actions' as const,
        block_id: MONSTER_SELECTION_BLOCK_ID,
        elements: [
          {
            type: 'static_select' as const,
            action_id: ATTACK_ACTIONS.MONSTER_SELECT,
            placeholder: {
              type: 'plain_text' as const,
              text: 'Select a target',
              emoji: true,
            },
            options,
            ...(firstOption
              ? {
                  initial_option: firstOption,
                }
              : {}),
          },
          {
            type: 'button' as const,
            action_id: ATTACK_ACTIONS.ATTACK_MONSTER,
            text: {
              type: 'plain_text' as const,
              text: 'Attack',
              emoji: true,
            },
            style: 'primary' as const,
            value: 'attack_target',
          },
        ],
      },
    ],
  };
}

export function buildCombatSummary(
  combat: AttackCombatResult,
  monsterName: string,
) {
  const playerWon = combat.winnerName !== monsterName;

  let msg = `You attacked ${monsterName}!`;
  if (playerWon) {
    msg += `\n${monsterName} was defeated!`;
    if (combat.xpGained > 0) {
      msg += `\nYou gained ${combat.xpGained} XP!`;
    }
    if (combat.goldGained > 0) {
      msg += `\nYou collected ${combat.goldGained} gold!`;
    }
  } else {
    msg += `\n${monsterName} defeated you!`;
  }

  msg += `\nCombat lasted ${combat.roundsCompleted} rounds.\n`;
  msg += `\n${combat.message}`;
  return msg;
}

export const attackHandlerHelp = `Attack the nearest monster using "attack". Or attack a player in this workspace from anywhere: "attack @username" or "attack username".`;

export const attackHandler = async ({
  userId,
  say,
  text,
  client,
}: HandlerContext) => {
  // For demo: attack the first nearby monster (could be improved with more context)
  try {
    // Try to parse a player target by username/mention
    const parts = text.trim().split(/\s+/);
    const maybeTarget = parts.length > 1 ? parts.slice(1).join(' ') : '';
    const mentionMatch = maybeTarget.match(/^<@([A-Z0-9]+)>$/i);
    const atNameMatch = maybeTarget.match(/^@([A-Za-z0-9._-]+)$/);

    if (mentionMatch || atNameMatch) {
      // Attack player by Slack identifier within this workspace
      const targetSlackId = mentionMatch ? mentionMatch[1] : undefined;
      // If we only have a username, we can't resolve to Slack ID here without Web API; delegate to DM by username support later if added.
      if (!targetSlackId) {
        await say({
          text: 'Please mention the user like "attack @username" so I can identify them.',
        });
        return;
      }
      const attackResult = await dmSdk.Attack({
        slackId: toClientId(userId),
        input: {
          targetType: TargetType.Player,
          targetSlackId,
          ignoreLocation: true,
        },
      });
      if (!attackResult.attack.success) {
        await say({ text: `Attack failed: ${attackResult.attack.message}` });
        return;
      }
      const combat = attackResult.attack.data;
      if (!combat) {
        await say({ text: 'Attack succeeded but no combat data returned.' });
        return;
      }
      // Do not send combat summaries directly here; NotificationService
      // will deliver tailored messages to both combatants via DM.
      await say({
        text: '⚔️ Combat initiated! Check your DMs for the results.',
      });
      console.log(JSON.stringify(combat, null, 2));
      return;
    }

    // Get current location, then load entities at exact location
    const playerResult = await dmSdk.GetPlayer({ slackId: toClientId(userId) });
    const player = playerResult.getPlayer.data;
    if (!player) {
      await say({ text: 'Could not find your player.' });
      return;
    }
    const { x, y } = player;
    const entities = await dmSdk.GetLocationEntities({ x, y });
    const monstersHere: NearbyMonster[] = (
      entities.getMonstersAtLocation || []
    ).map((m) => ({ id: String(m.id), name: m.name }));
    const playersHere: NearbyPlayer[] = (entities.getPlayersAtLocation || [])
      .filter((p) => p.slackId !== toClientId(userId))
      .map((p) => ({ slackId: p.slackId, name: p.name }));

    if (monstersHere.length === 0 && playersHere.length === 0) {
      await say({ text: 'No monsters or players here to attack!' });
      return;
    }

    await say(buildTargetSelectionMessage(monstersHere, playersHere));
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(err, 'Failed to attack');
    await say({ text: errorMessage });
  }
};

registerHandler(COMMANDS.ATTACK, attackHandler);
