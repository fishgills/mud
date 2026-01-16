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

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const buildEntriesFromLog = (log: DetailedCombatLog): CombatLogEntry[] => {
  return log.rounds.map((round) => {
    const attackLine = `${round.attackerName} strike: AR ${formatNumber(round.attackRating)} vs DR ${formatNumber(round.defenseRating)} (hit ${formatPercent(round.hitChance)}) -> ${round.hit ? 'HIT' : 'MISS'}`;
    let damageLine: string;
    if (round.hit) {
      const weaponSegment =
        round.weaponDamage > 0 ? ` + weapon ${round.weaponDamage}` : '';
      const critSegment = round.crit
        ? `, crit x${round.critMultiplier ?? 1.5}`
        : '';
      const breakdown = `core ${formatNumber(round.coreDamage)}${weaponSegment}, mit ${formatPercent(round.mitigation)}${critSegment}`;
      damageLine = `Damage: ${round.damage} (${breakdown}) -> ${round.defenderName} HP ${round.defenderHpAfter}${round.killed ? ' KO' : ''}`;
    } else {
      damageLine = `Damage: 0 -> ${round.defenderName} HP ${round.defenderHpAfter} (miss)`;
    }

    return {
      round: String(round.roundNumber),
      description: `${attackLine}\n${damageLine}`,
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

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
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

      if (entries.length > 0) {
        for (const group of chunk(entries, 12)) {
          const blockText = group
            .map((entry) => `• Round ${entry.round}: ${entry.description}`)
            .join('\n');
          newBlocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: blockText },
          } as SectionBlock);
        }
      } else {
        newBlocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: '```' + fullText + '```' },
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

      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: fullText,
        blocks: newBlocks.filter((b): b is KnownBlock => 'type' in b),
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
