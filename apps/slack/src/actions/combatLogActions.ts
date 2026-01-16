import type { App, BlockAction } from '@slack/bolt';
import type {
  ActionsBlock,
  Block,
  Button,
  DividerBlock,
  KnownBlock,
  SectionBlock,
} from '@slack/types';
import { COMBAT_ACTIONS } from '../commands';
import { getCombatLog, type DetailedCombatLog } from '../dm-client';

type CombatLogEntry = { round: string; description: string };

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

const buildEntriesFromLog = (log: DetailedCombatLog): CombatLogEntry[] => {
  return log.rounds.map((round) => {
    const hitRoll = formatRollPercent(round.hitRoll);
    const hitSegment = hitRoll ? ` (roll ${hitRoll})` : '';
    const attackLine = `${round.attackerName} strike: AR ${formatNumber(round.attackRating)} vs DR ${formatNumber(round.defenseRating)} (hit ${formatPercent(round.hitChance)}${hitSegment}) -> ${round.hit ? 'HIT' : 'MISS'}`;
    const ratingsMath = formatRatingsMath(round);
    let damageLine: string;
    if (round.hit) {
      const weaponSegment =
        round.weaponDamage > 0 ? `, ${formatWeaponRoll(round)}` : '';
      const critRoll = formatRollPercent(round.critRoll);
      const critSegment = round.crit
        ? `, crit x${round.critMultiplier ?? 1.5}`
        : '';
      const critRollSegment = critRoll ? ` (crit roll ${critRoll})` : '';
      const breakdown = `core ${formatNumber(round.coreDamage)}${weaponSegment}, mit ${formatPercent(round.mitigation)}${critSegment}${critRollSegment}`;
      damageLine = `Damage: ${round.damage} (${breakdown}) -> ${round.defenderName} HP ${round.defenderHpAfter}${round.killed ? ' KO' : ''}`;
    } else {
      damageLine = `Damage: 0 -> ${round.defenderName} HP ${round.defenderHpAfter} (miss)`;
    }

    const lines = [
      attackLine,
      ...(ratingsMath ? [ratingsMath] : []),
      damageLine,
    ]
      .map((line, index) => (index === 0 ? line : `    ${line}`))
      .join('\n');

    return {
      round: String(round.roundNumber),
      description: lines,
    };
  });
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

const isActionsBlock = (block: Block | KnownBlock): block is ActionsBlock =>
  (block as { type?: string }).type === 'actions';

const filterCombatLogActions = (
  elements: ActionsBlock['elements'],
): ActionsBlock['elements'] =>
  elements.filter((element) => {
    const actionId = 'action_id' in element ? element.action_id : undefined;
    return (
      actionId !== COMBAT_ACTIONS.SHOW_LOG &&
      actionId !== COMBAT_ACTIONS.HIDE_LOG
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

const extractCombatLogEntries = (fullText: string): CombatLogEntry[] => {
  const marker = '**Combat Log:**';
  const start = fullText.indexOf(marker);
  const text = start >= 0 ? fullText.slice(start + marker.length) : fullText;

  const regex =
    /Round\s+(\d+)(?:\s*:)?\s*([\s\S]*?)(?=(?:Round\s+\d+(?:\s*:)?\s*)|$)/gi;
  const entries: CombatLogEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const roundNo = match[1];
    const rawDesc = (match[2] || '').trim();
    const normalized = rawDesc
      .split(/\r?\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map((line, index) => (index === 0 ? line : `    ${line}`))
      .join('\n');
    if (roundNo) {
      entries.push({ round: roundNo, description: normalized });
    }
  }

  if (entries.length > 0) return entries;

  const rough = text.replace(/\.?\s+(?=Round\s+\d+(?:\s*:)?\s*)/g, '\n');
  return rough
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => /^Round\s+\d+(?:\s*:)?\s*/i.test(s))
    .map((line) => {
      const [, round = '', description = ''] =
        line.match(/Round\s+(\d+)(?:\s*:)?\s*(.*)$/i) || [];
      const normalized = description
        .split(/\r?\n+/)
        .map((part) => part.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .map((part, index) => (index === 0 ? part : `    ${part}`))
        .join('\n');
      return { round, description: normalized };
    })
    .filter((entry): entry is CombatLogEntry => Boolean(entry.round));
};

const buildEntryLines = (entries: CombatLogEntry[]): string[] => {
  return entries.map((entry) =>
    truncateText(`• Round ${entry.round}: ${entry.description}`),
  );
};

const buildSectionsFromLines = (
  lines: string[],
  maxBlocks: number,
): { blocks: SectionBlock[]; truncated: boolean } => {
  const blocks: SectionBlock[] = [];
  let current = '';
  let truncated = false;

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length <= SLACK_TEXT_LIMIT) {
      current = next;
      continue;
    }

    if (current) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: truncateText(current) },
      });
      if (blocks.length >= maxBlocks) {
        truncated = true;
        return { blocks, truncated };
      }
    }

    current = truncateText(line);
  }

  if (current) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: truncateText(current) },
    });
  }

  if (blocks.length > maxBlocks) {
    truncated = true;
    return { blocks: blocks.slice(0, maxBlocks), truncated };
  }

  return { blocks, truncated };
};

const truncateCodeBlock = (text: string): string => {
  const maxInner = Math.max(0, SLACK_TEXT_LIMIT - 6); // ``` + ```
  const inner = truncateText(text, maxInner);
  return `\`\`\`${inner}\`\`\``;
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

      newBlocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '*Combat Log*' },
      } as SectionBlock);

      let entries: CombatLogEntry[] = [];
      if (combatId) {
        try {
          const response = await getCombatLog(combatId);
          if (response.success && response.data) {
            entries = buildEntriesFromLog(response.data);
          }
        } catch {
          entries = [];
        }
      }

      if (entries.length === 0) {
        entries = extractCombatLogEntries(fullText);
      }

      const baseBlocksCount = newBlocks.length;
      const maxLogBlocks = Math.max(
        0,
        SLACK_BLOCKS_LIMIT - baseBlocksCount - 1,
      );

      if (entries.length > 0) {
        const lines = buildEntryLines(entries);
        const { blocks: logBlocks, truncated } = buildSectionsFromLines(
          lines,
          maxLogBlocks,
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
      const actions: ActionsBlock = { type: 'actions', elements: [hideButton] };
      newBlocks.push(actions);

      const blocks = newBlocks
        .filter((b): b is KnownBlock => 'type' in b)
        .slice(0, SLACK_BLOCKS_LIMIT);

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
