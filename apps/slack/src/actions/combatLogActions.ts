import type { App, BlockAction } from '@slack/bolt';
import type {
  ActionsBlock,
  Block,
  Button,
  ContextBlock,
  DividerBlock,
  KnownBlock,
  SectionBlock,
} from '@slack/types';
import { COMBAT_ACTIONS } from '../commands';
import { getCombatLog, type DetailedCombatLog } from '../dm-client';

const SLACK_TEXT_LIMIT = 3000;
const SLACK_BLOCKS_LIMIT = 50;

const truncateText = (text: string, limit = SLACK_TEXT_LIMIT): string => {
  if (text.length <= limit) return text;
  const suffix = '...';
  return `${text.slice(0, limit - suffix.length)}${suffix}`;
};

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const formatRollPercent = (value?: number): string | null => {
  if (typeof value !== 'number') return null;
  return `${(value * 100).toFixed(1)}%`;
};

const formatWeaponRoll = (
  round: DetailedCombatLog['rounds'][number],
): string => {
  const roll = round.weaponDamage;
  const rollLabel = round.weaponDamageRoll
    ? `${round.weaponDamageRoll} -> ${roll}`
    : `-> ${roll}`;
  return `weapon roll ${rollLabel}`;
};

const formatRatingsMath = (
  round: DetailedCombatLog['rounds'][number],
): string | null => {
  const attacker = round.attackerEffectiveStats;
  const defender = round.defenderEffectiveStats;
  if (!attacker || !defender) return null;

  const attackRating =
    10 * attacker.strength + 4 * attacker.agility + 6 * attacker.level;
  const defenseRating =
    10 * defender.agility + 2 * defender.health + 6 * defender.level;

  return [
    `AR math: 10*S'(${formatNumber(attacker.strength)})`,
    `+ 4*A'(${formatNumber(attacker.agility)})`,
    `+ 6*L'(${formatNumber(attacker.level)})`,
    `= ${formatNumber(attackRating)}`,
    `| DR math: 10*A'(${formatNumber(defender.agility)})`,
    `+ 2*H'(${formatNumber(defender.health)})`,
    `+ 6*L'(${formatNumber(defender.level)})`,
    `= ${formatNumber(defenseRating)}`,
  ].join(' ');
};

type RoundIcon = ':crossed_swords:' | ':dash:' | ':boom:' | ':skull:';

const getRoundIcon = (
  round: DetailedCombatLog['rounds'][number],
): RoundIcon => {
  if (round.killed) return ':skull:';
  if (round.crit) return ':boom:';
  if (round.hit) return ':crossed_swords:';
  return ':dash:';
};

const buildRoundHeadline = (
  round: DetailedCombatLog['rounds'][number],
): string => {
  const icon = getRoundIcon(round);
  const base = `${icon} *Round ${round.roundNumber}* ${round.attackerName} → ${round.defenderName}`;
  if (!round.hit) {
    return `${base}  miss`;
  }
  const critLabel = round.crit ? ' crit' : '';
  const koLabel = round.killed ? ' (KO)' : ` (HP ${round.defenderHpAfter})`;
  return `${base}  *${round.damage}* dmg${critLabel}${koLabel}`;
};

const buildRoundContext = (
  round: DetailedCombatLog['rounds'][number],
): string => {
  const hitPct = formatPercent(round.hitChance);
  const hitRoll = formatRollPercent(round.hitRoll);
  const rollPart = hitRoll ? ` (rolled ${hitRoll})` : '';

  if (!round.hit) {
    return `hit ${hitPct}${rollPart}`;
  }

  const corePart = `core ${formatNumber(round.coreDamage)}`;
  const weaponPart =
    round.weaponDamage > 0 ? ` · ${formatWeaponRoll(round)}` : '';
  const mitPart = ` · mit ${formatPercent(round.mitigation)}`;

  return `hit ${hitPct}${rollPart} · ${corePart}${weaponPart}${mitPart}`;
};

const buildRoundMathContext = (
  round: DetailedCombatLog['rounds'][number],
): string | null => {
  const math = formatRatingsMath(round);
  if (!math) return null;
  const critRoll = formatRollPercent(round.critRoll);
  const critRollPart = critRoll ? ` · crit roll ${critRoll}` : '';
  return `${math}${critRollPart}`;
};

type SideStats = {
  name: string;
  hits: number;
  total: number;
  crits: number;
  damage: number;
};

const buildScoreboard = (log: DetailedCombatLog): SectionBlock => {
  const sides = new Map<string, SideStats>();

  for (const round of log.rounds) {
    const attacker = round.attackerName;
    const defender = round.defenderName;

    if (!sides.has(attacker)) {
      sides.set(attacker, {
        name: attacker,
        hits: 0,
        total: 0,
        crits: 0,
        damage: 0,
      });
    }
    if (!sides.has(defender)) {
      sides.set(defender, {
        name: defender,
        hits: 0,
        total: 0,
        crits: 0,
        damage: 0,
      });
    }

    const side = sides.get(attacker)!;
    side.total += 1;
    if (round.hit) {
      side.hits += 1;
      side.damage += round.damage;
    }
    if (round.crit) {
      side.crits += 1;
    }
  }

  const firstAttacker = log.firstAttacker;
  const names = [...sides.keys()];
  const sorted = names.sort((a, b) => {
    if (a === firstAttacker) return -1;
    if (b === firstAttacker) return 1;
    return 0;
  });

  const roundCount = log.rounds.length;
  const lines: string[] = [`*Combat Log* — ${roundCount} rounds`];

  for (const name of sorted) {
    const s = sides.get(name)!;
    const opponentName = sorted.find((n) => n !== name) ?? '?';
    const isFirst = name === sorted[0];
    const icon = isFirst ? ':crossed_swords:' : ':shield:';
    lines.push(
      `${icon} ${s.name} → ${opponentName}: ${s.hits}/${s.total} hits · ${s.crits} crits · ${s.damage} dmg`,
    );
  }

  return {
    type: 'section',
    text: { type: 'mrkdwn', text: lines.join('\n') },
  };
};

const buildLogBlocks = (
  log: DetailedCombatLog,
  maxBlocks: number,
  includeMath: boolean,
): { blocks: (SectionBlock | ContextBlock)[]; truncated: boolean } => {
  const blocks: (SectionBlock | ContextBlock)[] = [];
  let truncated = false;

  for (const round of log.rounds) {
    if (blocks.length + 2 > maxBlocks) {
      truncated = true;
      break;
    }

    const headlineBlock: SectionBlock = {
      type: 'section',
      text: { type: 'mrkdwn', text: buildRoundHeadline(round) },
    };
    blocks.push(headlineBlock);

    const contextText = buildRoundContext(round);
    const contextElements: ContextBlock['elements'] = [
      { type: 'mrkdwn', text: contextText },
    ];

    if (includeMath) {
      const mathText = buildRoundMathContext(round);
      if (mathText) {
        contextElements.push({ type: 'mrkdwn', text: mathText });
      }
    }

    const contextBlock: ContextBlock = {
      type: 'context',
      elements: contextElements,
    };
    blocks.push(contextBlock);
  }

  return { blocks, truncated };
};

const truncateCodeBlock = (text: string): string => {
  const maxInner = Math.max(0, SLACK_TEXT_LIMIT - 6);
  const inner = truncateText(text, maxInner);
  return `\`\`\`${inner}\`\`\``;
};

type ActionElement = BlockAction['actions'][number];

const isActionWithValue = (
  action: ActionElement,
): action is ActionElement & { value: string } =>
  typeof (action as { value?: unknown }).value === 'string';

const getActionValue = (
  actions?: BlockAction['actions'],
): string | undefined => {
  if (!actions || actions.length === 0) return undefined;
  const candidate = actions.find(isActionWithValue);
  return candidate?.value;
};

const parseCombatLogValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { combatId?: string };
      if (typeof parsed?.combatId === 'string') return parsed.combatId;
    } catch {
      return undefined;
    }
  }
  return trimmed;
};

const isActionsBlock = (block: Block | KnownBlock): block is ActionsBlock =>
  (block as { type?: string }).type === 'actions';

const filterCombatLogActions = (
  elements: ActionsBlock['elements'],
): ActionsBlock['elements'] =>
  elements.filter((element) => {
    const actionId = 'action_id' in element ? element.action_id : undefined;
    return (
      actionId !== COMBAT_ACTIONS.SHOW_LOG &&
      actionId !== COMBAT_ACTIONS.HIDE_LOG &&
      actionId !== COMBAT_ACTIONS.SHOW_MATH_LOG &&
      actionId !== COMBAT_ACTIONS.HIDE_MATH_LOG
    );
  });

const getPreservedActionBlocks = (
  blocks: (KnownBlock | Block)[],
): ActionsBlock[] => {
  const preserved: ActionsBlock[] = [];
  for (const block of blocks) {
    if (!isActionsBlock(block) || !Array.isArray(block.elements)) continue;
    const elements = filterCombatLogActions(block.elements);
    if (elements.length === 0) continue;
    preserved.push({ ...block, elements });
  }
  return preserved;
};

const buildExpandedView = async (
  combatId: string | undefined,
  fullText: string,
  originalBlocks: (KnownBlock | Block)[],
  includeMath: boolean,
): Promise<(KnownBlock | Block)[]> => {
  const preservedActions = getPreservedActionBlocks(originalBlocks);
  const summarySection = originalBlocks.find(
    (b): b is SectionBlock =>
      typeof (b as { type?: string }).type === 'string' &&
      (b as { type?: string }).type === 'section',
  );

  const newBlocks: (KnownBlock | Block)[] = [];
  if (summarySection) newBlocks.push(summarySection);
  if (preservedActions.length > 0) {
    newBlocks.push(...preservedActions);
  }
  const divider: DividerBlock = { type: 'divider' };
  newBlocks.push(divider);

  let log: DetailedCombatLog | null = null;
  if (combatId) {
    try {
      const response = await getCombatLog(combatId);
      if (response.success && response.data) {
        log = response.data;
      }
    } catch {
      log = null;
    }
  }

  if (log && log.rounds.length > 0) {
    const scoreboard = buildScoreboard(log);
    newBlocks.push(scoreboard);

    const baseBlocksCount = newBlocks.length;
    // Reserve 1 block for buttons, 1 for possible truncation notice
    const maxLogBlocks = Math.max(0, SLACK_BLOCKS_LIMIT - baseBlocksCount - 2);

    const { blocks: logBlocks, truncated } = buildLogBlocks(
      log,
      maxLogBlocks,
      includeMath,
    );
    newBlocks.push(...logBlocks);

    if (truncated && newBlocks.length < SLACK_BLOCKS_LIMIT - 1) {
      newBlocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '_Combat log truncated._' },
      } as SectionBlock);
    }
  } else {
    newBlocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: truncateCodeBlock(fullText) },
    } as SectionBlock);
  }

  const hideButton: Button = {
    type: 'button',
    action_id: COMBAT_ACTIONS.HIDE_LOG,
    text: { type: 'plain_text', text: 'Hide combat log' },
    style: 'danger',
  };
  if (combatId) {
    hideButton.value = combatId;
  }

  const mathButton: Button = includeMath
    ? {
        type: 'button',
        action_id: COMBAT_ACTIONS.HIDE_MATH_LOG,
        text: { type: 'plain_text', text: 'Hide math' },
        ...(combatId ? { value: combatId } : {}),
      }
    : {
        type: 'button',
        action_id: COMBAT_ACTIONS.SHOW_MATH_LOG,
        text: { type: 'plain_text', text: 'Show math' },
        ...(combatId ? { value: combatId } : {}),
      };

  const actions: ActionsBlock = {
    type: 'actions',
    elements: [hideButton, mathButton],
  };
  newBlocks.push(actions);

  return newBlocks
    .filter((b): b is KnownBlock => 'type' in b)
    .slice(0, SLACK_BLOCKS_LIMIT);
};

export const registerCombatLogActions = (app: App) => {
  app.action<BlockAction>(
    COMBAT_ACTIONS.SHOW_LOG,
    async ({ ack, body, client }) => {
      await ack();

      const combatId = parseCombatLogValue(getActionValue(body.actions));
      const channelId =
        body.channel?.id ||
        (typeof body.container?.channel_id === 'string'
          ? body.container.channel_id
          : undefined);
      const messageTs =
        (typeof body.message?.ts === 'string' ? body.message.ts : undefined) ||
        (typeof body.container?.message_ts === 'string'
          ? body.container.message_ts
          : undefined);

      if (!channelId || !messageTs) return;

      const fullText =
        typeof body.message?.text === 'string' ? body.message.text : '';
      const originalBlocks = (body.message?.blocks || []) as (
        | KnownBlock
        | Block
      )[];

      const blocks = await buildExpandedView(
        combatId,
        fullText,
        originalBlocks,
        false,
      );

      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: fullText,
        blocks,
      });
    },
  );

  app.action<BlockAction>(
    COMBAT_ACTIONS.SHOW_MATH_LOG,
    async ({ ack, body, client }) => {
      await ack();

      const combatId = parseCombatLogValue(getActionValue(body.actions));
      const channelId =
        body.channel?.id ||
        (typeof body.container?.channel_id === 'string'
          ? body.container.channel_id
          : undefined);
      const messageTs =
        (typeof body.message?.ts === 'string' ? body.message.ts : undefined) ||
        (typeof body.container?.message_ts === 'string'
          ? body.container.message_ts
          : undefined);

      if (!channelId || !messageTs) return;

      const fullText =
        typeof body.message?.text === 'string' ? body.message.text : '';
      const originalBlocks = (body.message?.blocks || []) as (
        | KnownBlock
        | Block
      )[];

      const blocks = await buildExpandedView(
        combatId,
        fullText,
        originalBlocks,
        true,
      );

      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: fullText,
        blocks,
      });
    },
  );

  app.action<BlockAction>(
    COMBAT_ACTIONS.HIDE_MATH_LOG,
    async ({ ack, body, client }) => {
      await ack();

      const combatId = parseCombatLogValue(getActionValue(body.actions));
      const channelId =
        body.channel?.id ||
        (typeof body.container?.channel_id === 'string'
          ? body.container.channel_id
          : undefined);
      const messageTs =
        (typeof body.message?.ts === 'string' ? body.message.ts : undefined) ||
        (typeof body.container?.message_ts === 'string'
          ? body.container.message_ts
          : undefined);

      if (!channelId || !messageTs) return;

      const fullText =
        typeof body.message?.text === 'string' ? body.message.text : '';
      const originalBlocks = (body.message?.blocks || []) as (
        | KnownBlock
        | Block
      )[];

      const blocks = await buildExpandedView(
        combatId,
        fullText,
        originalBlocks,
        false,
      );

      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: fullText,
        blocks,
      });
    },
  );

  app.action<BlockAction>(
    COMBAT_ACTIONS.HIDE_LOG,
    async ({ ack, body, client }) => {
      await ack();

      const combatId = parseCombatLogValue(getActionValue(body.actions));
      const channelId =
        body.channel?.id ||
        (typeof body.container?.channel_id === 'string'
          ? body.container.channel_id
          : undefined);
      const messageTs =
        (typeof body.message?.ts === 'string' ? body.message.ts : undefined) ||
        (typeof body.container?.message_ts === 'string'
          ? body.container.message_ts
          : undefined);

      if (!channelId || !messageTs) return;

      const originalBlocks = (body.message?.blocks || []) as (
        | KnownBlock
        | Block
      )[];
      const preservedActions = getPreservedActionBlocks(originalBlocks);
      const summarySection = originalBlocks.find(
        (b): b is SectionBlock =>
          typeof (b as { type?: string }).type === 'string' &&
          (b as { type?: string }).type === 'section',
      );

      const blocks: (KnownBlock | Block)[] = [];
      if (summarySection) blocks.push(summarySection);
      if (preservedActions.length > 0) {
        blocks.push(...preservedActions);
      }
      const showButton: Button = {
        type: 'button',
        action_id: COMBAT_ACTIONS.SHOW_LOG,
        text: { type: 'plain_text', text: 'View full combat log' },
        style: 'primary',
      };
      if (combatId) {
        showButton.value = combatId;
      }
      const showActions: ActionsBlock = {
        type: 'actions',
        elements: [showButton],
      };
      blocks.push(showActions);

      const fullText =
        typeof body.message?.text === 'string' ? body.message.text : '';

      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: fullText,
        blocks: blocks.filter((b): b is KnownBlock => 'type' in b),
      });
    },
  );
};
