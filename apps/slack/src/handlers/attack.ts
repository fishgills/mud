import { TargetType } from '../dm-types';
import { HandlerContext } from './types';
import { COMMANDS, ATTACK_ACTIONS } from '../commands';
import { extractSlackId } from '../utils/clientId';
import { PlayerCommandHandler } from './base';
import {
  buildAttackFailureMessage,
  isMissingTargetCharacterMessage,
  notifyTargetAboutMissingCharacter,
} from './attackNotifications';

export const MONSTER_SELECTION_BLOCK_ID = 'attack_monster_selection_block';
export const SELF_ATTACK_ERROR = "You can't attack yourself.";

type AttackCombatResult = {
  winnerName: string;
  loserName: string;
  totalDamageDealt: number;
  roundsCompleted: number;
  xpGained: number;
  goldGained: number;
  message: string;
};

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

export class AttackHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.ATTACK, 'Failed to attack');
  }

  protected async perform({
    userId,
    say,
    text,
    client,
  }: HandlerContext): Promise<void> {
    const start = Date.now();
    const metrics: {
      branch: string;
      dmAttackMs: number;
      dmGetPlayerMs: number;
      dmGetLocationEntitiesMs: number;
      targetType?: string;
    } = {
      branch: 'initial',
      dmAttackMs: 0,
      dmGetPlayerMs: 0,
      dmGetLocationEntitiesMs: 0,
      targetType: undefined,
    };
    let perfDetails: Record<string, unknown> = {};
    const clientId = this.toClientId(userId);
    const emitPerf = () => {
      try {
        const payload = {
          event: 'slack.attack.perf',
          slackUserId: userId,
          totalMs: Date.now() - start,
          ...metrics,
          ...perfDetails,
        };
        console.log(JSON.stringify(payload));
      } catch (error) {
        void error;
      }
    };

    try {
      const parts = text.trim().split(/\s+/);
      const maybeTarget = parts.length > 1 ? parts.slice(1).join(' ') : '';
      const mentionMatch = maybeTarget.match(/^<@([A-Z0-9]+)>$/i);
      const atNameMatch = maybeTarget.match(/^@([A-Za-z0-9._-]+)$/);

      if (mentionMatch || atNameMatch) {
        metrics.branch = 'direct-target';
        metrics.targetType = 'player';

        const targetSlackId = mentionMatch ? mentionMatch[1] : undefined;
        if (!targetSlackId) {
          await say({
            text: 'Please mention the user like "attack @username" so I can identify them.',
          });
          perfDetails = {
            success: false,
            reason: 'missing-target-slack-id',
          };
          return;
        }
        if (targetSlackId === userId) {
          await say({ text: SELF_ATTACK_ERROR });
          perfDetails = {
            success: false,
            reason: 'self-target',
          };
          return;
        }

        const attackStart = Date.now();
        const attackResult = await this.dm.attack({
          slackId: clientId,
          input: {
            targetType: TargetType.Player,
            targetSlackId,
            ignoreLocation: true,
          },
        });
        metrics.dmAttackMs = Date.now() - attackStart;

        if (!attackResult.success) {
          await say({
            text: buildAttackFailureMessage(attackResult.message, {
              targetKind: 'player',
              targetName: `<@${targetSlackId}>`,
            }),
          });

          if (isMissingTargetCharacterMessage(attackResult.message)) {
            await notifyTargetAboutMissingCharacter(
              client,
              userId,
              targetSlackId,
            );
          }
          perfDetails = {
            success: false,
            reason: 'dm-attack-failed',
            dmMessage: attackResult.message,
            dmPerf: attackResult.perf,
          };
          return;
        }

        const combat = attackResult.data as AttackCombatResult | undefined;
        if (!combat) {
          await say({ text: 'Attack succeeded but no combat data returned.' });
          perfDetails = {
            success: false,
            reason: 'missing-combat-data',
            dmPerf: attackResult.perf,
          };
          return;
        }

        await say({
          text: '⚔️ Combat initiated! Check your DMs for the results.',
        });
        console.log(JSON.stringify(combat, null, 2));
        perfDetails = {
          success: true,
          path: 'direct-target',
          dmPerf: attackResult.perf,
        };
        return;
      }

      metrics.branch = 'selection';
      metrics.targetType = undefined;

      const playerLookupStart = Date.now();
      const playerResult = await this.dm.getPlayer({
        slackId: clientId,
      });
      metrics.dmGetPlayerMs = Date.now() - playerLookupStart;

      const player = playerResult.data;
      if (!player) {
        await say({ text: 'Could not find your player.' });
        perfDetails = {
          success: false,
          reason: 'player-not-found',
        };
        return;
      }

      const { x, y } = player;
      if (typeof x !== 'number' || typeof y !== 'number') {
        await say({ text: 'Unable to determine your current location.' });
        perfDetails = {
          success: false,
          reason: 'missing-location',
        };
        return;
      }

      const entitiesStart = Date.now();
      const entities = await this.dm.getLocationEntities({ x, y });
      metrics.dmGetLocationEntitiesMs = Date.now() - entitiesStart;

      const monstersHere: NearbyMonster[] = (entities.monsters || []).map(
        (m) => ({
          id: String(m.id ?? ''),
          name: m.name ?? 'Unknown Monster',
        }),
      );
      const playersHere: NearbyPlayer[] = (entities.players || [])
        .map((p) => {
          const slackId = extractSlackId(p);
          if (!slackId || slackId === userId) {
            return null;
          }
          return {
            slackId,
            name: p.name ?? 'Unknown Adventurer',
          };
        })
        .filter((p): p is NearbyPlayer => p !== null);

      if (monstersHere.length === 0 && playersHere.length === 0) {
        await say({ text: 'No monsters or players here to attack!' });
        perfDetails = {
          success: false,
          reason: 'no-targets',
        };
        return;
      }

      await say(buildTargetSelectionMessage(monstersHere, playersHere));
      perfDetails = {
        success: true,
        path: 'selection',
        monsters: monstersHere.length,
        players: playersHere.length,
      };
    } catch (error) {
      perfDetails = {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown attack handler error',
      };
      throw error;
    } finally {
      emitPerf();
    }
  }
}

export const attackHandler = new AttackHandler();
