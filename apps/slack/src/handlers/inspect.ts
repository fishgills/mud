import type { BlockAction, AckFn } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import type { WebClient } from '@slack/web-api';
import { getQualityBadge, formatQualityLabel } from '@mud/constants';
import { COMMANDS, INSPECT_ACTIONS } from '../commands';
import { PlayerCommandHandler } from './base';
import type { HandlerContext } from './types';

import { requireCharacter } from './characterUtils';
import {
  buildPlayerOption,
  buildMonsterOption,
  buildItemOption,
  decodePlayerSelection,
  PLAYER_SELECTION_PREFIX,
} from './entitySelection';
import type { SlackOption } from './entitySelection';
import type {
  ItemDetails,
  ItemRecord,
  LocationEntitiesResult,
  PlayerRecord,
  MonsterRecord,
  EquipmentTotals,
} from '../dm-client';
import {
  buildPlayerStatsMessage,
  buildMonsterStatsMessage,
} from './stats/format';
import type { PlayerStatsSource, MonsterStatsSource } from './stats/types';
import type { NearbyPlayer, NearbyMonster, NearbyItem } from './locationUtils';

export const INSPECT_SELECTION_BLOCK_ID = 'inspect_selection_block';

type InspectablePlayer = NearbyPlayer & { userId: string; teamId: string };

type InspectableMonster = NearbyMonster & { id: number | string };

type InspectableItem = NearbyItem & { id: number | string };

type InspectActionArgs = {
  ack: AckFn<void>;
  body: BlockAction;
  client: WebClient;
};

function buildInspectSelectionMessage(
  players: InspectablePlayer[],
  monsters: InspectableMonster[],
  items: InspectableItem[],
) {
  const headerParts: string[] = [];
  if (players.length > 0) {
    headerParts.push(
      `players: ${players.map((p) => p.name ?? 'Unknown Adventurer').join(', ')}`,
    );
  }
  if (monsters.length > 0) {
    headerParts.push(
      `monsters: ${monsters.map((m) => m.name ?? 'Unknown Monster').join(', ')}`,
    );
  }
  if (items.length > 0) {
    headerParts.push(
      `items: ${items
        .map((i) => i.itemName ?? `Item ${i.id ?? '?'}`)
        .join(', ')}`,
    );
  }

  const headerText = headerParts.length
    ? `You see the following at your location — ${headerParts.join(' | ')}`
    : 'Choose something to inspect:';

  const options: SlackOption[] = [];

  for (const player of players) {
    const option = buildPlayerOption(player);
    if (option) {
      options.push(option);
    }
  }

  for (const monster of monsters) {
    const option = buildMonsterOption(monster);
    if (option) {
      options.push(option);
    }
  }

  for (const item of items) {
    const option = buildItemOption(item);
    if (option) {
      options.push(option);
    }
  }

  const firstOption = options[0];

  return {
    optionCount: options.length,
    message: {
      text: 'Choose something to inspect',
      blocks: [
        {
          type: 'section' as const,
          text: { type: 'mrkdwn' as const, text: headerText },
        },
        {
          type: 'actions' as const,
          block_id: INSPECT_SELECTION_BLOCK_ID,
          elements: [
            {
              type: 'static_select' as const,
              action_id: INSPECT_ACTIONS.TARGET_SELECT,
              placeholder: {
                type: 'plain_text' as const,
                text: 'Select a target',
                emoji: true,
              },
              options,
              ...(firstOption ? { initial_option: firstOption } : {}),
            },
            {
              type: 'button' as const,
              action_id: INSPECT_ACTIONS.INSPECT_TARGET,
              text: {
                type: 'plain_text' as const,
                text: 'Inspect',
                emoji: true,
              },
              style: 'primary' as const,
              value: 'inspect_target',
            },
          ],
        },
      ],
    },
  };
}

function normalizePlayers(
  players: LocationEntitiesResult['players'] = [],
  excludeSelfUserId: string,
  excludeTeamId: string,
): InspectablePlayer[] {
  const list: InspectablePlayer[] = [];
  for (const record of players ?? []) {
    const playerSlackUser = (
      record as {
        slackUser?: { userId: string; teamId: string };
      }
    ).slackUser;
    const userId = playerSlackUser?.userId;
    const teamId = playerSlackUser?.teamId;
    if (!userId) {
      continue;
    }
    if (!teamId) {
      continue;
    }
    // Exclude the current player from the list
    if (userId === excludeSelfUserId && teamId === excludeTeamId) {
      continue;
    }
    list.push({
      id: record.id ?? undefined,
      name: record.name ?? 'Unknown Adventurer',
      userId,
      teamId,
      isAlive: record.isAlive,
    });
  }

  return list;
}

function normalizeMonsters(
  monsters: LocationEntitiesResult['monsters'] = [],
): InspectableMonster[] {
  return (monsters ?? [])
    .filter((m) => m && (m.id !== undefined || m.name))
    .map((m) => ({
      id: m.id ?? m.name ?? 'unknown',
      name: m.name ?? 'Unknown Monster',
      isAlive: m.isAlive,
      hp: m.hp,
    }));
}

function normalizeItems(items: ItemRecord[] = []): InspectableItem[] {
  return (items ?? [])
    .filter(
      (item) => item && (item.id !== undefined || item.itemId !== undefined),
    )
    .map((item) => ({
      id: item.id ?? item.itemId ?? 'unknown',
      itemId: item.itemId,
      itemName:
        item.itemName ?? (item.itemId ? `Item ${item.itemId}` : undefined),
      quantity: item.quantity,
      quality: item.quality ?? undefined,
    }));
}

type CombatantSnapshot = {
  name?: string | null;
  hp?: number | null;
  maxHp?: number | null;
  strength?: number | null;
  agility?: number | null;
  health?: number | null;
  level?: number | null;
  equipmentTotals?: EquipmentTotals | null;
};

type CombatOdds = {
  emoji: string;
  label: string;
  detail: string;
  ratio: number;
  attackerScore: number;
  defenderScore: number;
};

const formatSigned = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) {
    return '0';
  }
  if (value > 0) {
    return `+${value}`;
  }
  return `${value}`;
};

const sanitizeMarkdown = (text: string | null | undefined): string | null => {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, ' ');
};

const toKnownBlocks = (blocks: unknown): KnownBlock[] => {
  if (!Array.isArray(blocks)) return [];
  return blocks.filter((b): b is KnownBlock => Boolean(b)) as KnownBlock[];
};

const computePowerScore = (snapshot: CombatantSnapshot): number => {
  const hp = typeof snapshot.hp === 'number' ? snapshot.hp : 0;
  const maxHp = typeof snapshot.maxHp === 'number' ? snapshot.maxHp : hp;
  const strength =
    typeof snapshot.strength === 'number' ? snapshot.strength : 10;
  const agility = typeof snapshot.agility === 'number' ? snapshot.agility : 10;
  const vitality = typeof snapshot.health === 'number' ? snapshot.health : 10;
  const level = typeof snapshot.level === 'number' ? snapshot.level : 1;

  const equipmentTotals = snapshot.equipmentTotals ?? null;
  const hpBonus = typeof equipmentTotals?.hpBonus === 'number'
    ? equipmentTotals.hpBonus
    : 0;
  const attackBonus = typeof equipmentTotals?.attackBonus === 'number'
    ? equipmentTotals.attackBonus
    : 0;
  const damageBonus = typeof equipmentTotals?.damageBonus === 'number'
    ? equipmentTotals.damageBonus
    : 0;
  const armorBonus = typeof equipmentTotals?.armorBonus === 'number'
    ? equipmentTotals.armorBonus
    : 0;

  const effectiveHp = Math.max(maxHp + hpBonus, hp + hpBonus, 1);
  return (
    effectiveHp * 0.6 +
    Math.max(strength, 0) * 2 +
    Math.max(agility, 0) * 1.5 +
    Math.max(vitality, 0) * 1.5 +
    Math.max(level, 0) * 5 +
    Math.max(attackBonus, 0) * 1.6 +
    Math.max(damageBonus, 0) * 1.4 +
    Math.max(armorBonus, 0) * 1.2
  );
};

const estimateCombatOdds = (
  attacker: CombatantSnapshot,
  defender: CombatantSnapshot,
): CombatOdds => {
  const attackerScore = Math.max(computePowerScore(attacker), 1);
  const defenderScore = Math.max(computePowerScore(defender), 1);
  const ratio = attackerScore / defenderScore;

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return {
      emoji: '🟡',
      label: 'Unknown odds',
      detail: 'Combat data is incomplete; proceed with caution.',
      ratio: 1,
      attackerScore,
      defenderScore,
    };
  }

  if (ratio >= 1.75) {
    return {
      emoji: '🔵',
      label: 'Overwhelming edge',
      detail: 'You should dominate this encounter.',
      ratio,
      attackerScore,
      defenderScore,
    };
  }
  if (ratio >= 1.3) {
    return {
      emoji: '🟢',
      label: 'Favorable odds',
      detail: 'You hold a clear advantage, but stay alert.',
      ratio,
      attackerScore,
      defenderScore,
    };
  }
  if (ratio >= 0.9) {
    return {
      emoji: '🟡',
      label: 'Even clash',
      detail: 'This fight could go either way.',
      ratio,
      attackerScore,
      defenderScore,
    };
  }
  if (ratio >= 0.6) {
    return {
      emoji: '🟠',
      label: 'Risky fight',
      detail: 'They have the upper hand; prepare or reconsider.',
      ratio,
      attackerScore,
      defenderScore,
    };
  }
  return {
    emoji: '🔴',
    label: 'Dire odds',
    detail: 'Retreat, regroup, or bring allies before engaging.',
    ratio,
    attackerScore,
    defenderScore,
  };
};

const buildOddsBlocks = (
  attackerName: string,
  defenderName: string,
  odds: CombatOdds,
): KnownBlock[] => {
  const ratioPercent = Math.round(odds.ratio * 100);
  const summaryLine = `${odds.emoji} *${odds.label}* — ${odds.detail}`;
  const ratioLine = `_Power ratio ${ratioPercent}% · ${attackerName} ${Math.round(odds.attackerScore)} vs ${defenderName} ${Math.round(odds.defenderScore)}_`;

  return [
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: summaryLine }],
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: ratioLine }],
    },
  ];
};

const parseItemSelection = (
  raw: string,
): { worldId?: number; itemId?: number } => {
  const [worldPart, itemPart] = raw.split('|', 2);
  const worldId = Number(worldPart);
  const itemId = Number(itemPart);
  return {
    worldId: Number.isFinite(worldId) && worldPart !== '' ? worldId : undefined,
    itemId: Number.isFinite(itemId) && itemPart !== '' ? itemId : undefined,
  };
};

const buildItemInspectMessage = (
  item: InspectableItem | null,
  details?: ItemDetails,
): { text: string; blocks: KnownBlock[] } => {
  const name =
    details?.name ??
    item?.itemName ??
    (item?.id ? `Item ${item.id}` : 'Unknown item');
  const quality = item?.quality ?? undefined;
  const badge = getQualityBadge(quality ?? 'Common');
  const qualityLabel = formatQualityLabel(quality ?? 'Common');

  const headerText = `${badge} ${name}`.trim();

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: headerText, emoji: true },
    },
  ];

  const primaryFields: { type: 'mrkdwn'; text: string }[] = [];
  if (details?.type) {
    primaryFields.push({ type: 'mrkdwn', text: `*Type*\n${details.type}` });
  }
  if (qualityLabel) {
    primaryFields.push({ type: 'mrkdwn', text: `*Quality*\n${qualityLabel}` });
  }
  if (details?.slot) {
    primaryFields.push({ type: 'mrkdwn', text: `*Slot*\n${details.slot}` });
  }
  if (typeof details?.value === 'number') {
    primaryFields.push({
      type: 'mrkdwn',
      text: `*Value*\n${details.value} gold`,
    });
  }
  if (typeof item?.quantity === 'number' && item.quantity > 1) {
    primaryFields.push({
      type: 'mrkdwn',
      text: `*Quantity*\n${item.quantity}`,
    });
  }

  if (primaryFields.length > 0) {
    blocks.push({ type: 'section', fields: primaryFields });
  }

  const bonusLines: string[] = [];
  if (typeof details?.attack === 'number' && details.attack !== 0) {
    bonusLines.push(`• Attack ${formatSigned(details.attack)}`);
  }
  if (typeof details?.defense === 'number' && details.defense !== 0) {
    bonusLines.push(`• Defense ${formatSigned(details.defense)}`);
  }
  if (typeof details?.healthBonus === 'number' && details.healthBonus !== 0) {
    bonusLines.push(`• Vitality ${formatSigned(details.healthBonus)}`);
  }

  if (bonusLines.length > 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Bonuses*\n${bonusLines.join('\n')}` },
    });
  }

  const description = sanitizeMarkdown(details?.description);
  if (description) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: description },
    });
  }

  const text = `${name} — ${qualityLabel}`;
  return { text, blocks };
};

class InspectHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.INSPECT, 'Failed to inspect surroundings');
  }

  protected async perform({
    userId,
    say,
    text,
    resolveUserId,
  }: HandlerContext): Promise<void> {
    if (!this.teamId) return;
    const player = await requireCharacter(this.teamId, userId, say);
    if (!player) return;

    // Check if user wants to inspect a specific player by mention
    // Extract text after "inspect" command (e.g., "inspect @John" → "@John" or "inspect <@U123>" → "<@U123>")
    const fullText = (text || '').trim();
    const inspectMatch = fullText.match(/^inspect\s+(.+)$/i);

    if (inspectMatch) {
      const targetMention = inspectMatch[1].trim();
      const targetSlackId = await resolveUserId?.(targetMention);

      if (targetSlackId) {
        // Directly inspect the mentioned player - use simple DM-based approach
        const targetRes = await this.dm.getPlayer({
          teamId: this.teamId,
          userId: targetSlackId,
        });
        const target = targetRes.data;
        if (!target) {
          await say({
            text: targetRes.message ?? 'I could not find that adventurer.',
          });
          return;
        }

        // Build and display the inspection result
        const statsMessage = buildPlayerStatsMessage(target, { isSelf: false });
        await say(statsMessage);
        return;
      }
    }

    const { x, y } = player;
    if (typeof x !== 'number' || typeof y !== 'number') {
      await say({ text: 'Unable to determine your current location.' });
      return;
    }

    const entities = await this.dm.getLocationEntities({ x, y });
    const items = normalizeItems(entities.items);

    const players = normalizePlayers(entities.players, userId, this.teamId!);
    const monsters = normalizeMonsters(entities.monsters);

    const { message, optionCount } = buildInspectSelectionMessage(
      players,
      monsters,
      items,
    );

    if (optionCount === 0) {
      await say({
        text: 'No nearby players, monsters, or items to inspect!',
      });
      return;
    }

    await say(message);
  }

  private getChannelId(body: BlockAction): string | undefined {
    if (typeof body.channel?.id === 'string') {
      return body.channel.id;
    }
    const containerChannel =
      typeof body.container?.channel_id === 'string'
        ? body.container.channel_id
        : undefined;
    if (containerChannel) {
      return containerChannel;
    }
    const messageChannel =
      typeof body.message?.channel === 'string'
        ? body.message.channel
        : undefined;
    return messageChannel;
  }

  private async safePostMessage(
    client: WebClient | undefined,
    channelId: string,
    message: { text?: string; blocks?: KnownBlock[] },
  ): Promise<boolean> {
    if (!client) return false;
    await client.chat.postMessage({
      channel: channelId,
      text: message.text ?? 'Inspection update',
      ...(message.blocks ? { blocks: message.blocks } : {}),
    });
    return true;
  }

  private async safeDm(
    client: WebClient | undefined,
    userId: string,
    message: { text?: string; blocks?: KnownBlock[] },
  ): Promise<boolean> {
    if (!client) return false;
    const dm = await client.conversations.open({ users: userId });
    const channelId = dm.channel?.id;
    if (!channelId) {
      return false;
    }
    await client.chat.postMessage({
      channel: channelId,
      text: message.text ?? 'Inspection update',
      ...(message.blocks ? { blocks: message.blocks } : {}),
    });
    return true;
  }

  private async respondWithMessage(
    client: WebClient | undefined,
    body: BlockAction,
    message: { text?: string; blocks?: KnownBlock[] },
  ): Promise<void> {
    const channelId = this.getChannelId(body);
    if (channelId && (await this.safePostMessage(client, channelId, message))) {
      return;
    }
    const userId = body.user?.id;
    if (userId) {
      await this.safeDm(client, userId, message);
    }
  }

  private async respondFailure(
    client: WebClient | undefined,
    body: BlockAction,
    text: string,
  ): Promise<void> {
    await this.respondWithMessage(client, body, { text });
  }

  private async fetchInspector(userId: string): Promise<{
    player: PlayerRecord | null;
    message?: string;
  }> {
    const res = await this.dm.getPlayer({ teamId: this.teamId!, userId });
    return {
      player: res.data ?? null,
      message: res.message,
    };
  }

  private async handlePlayerInspect(
    client: WebClient | undefined,
    body: BlockAction,
    selection: { userId: string; teamId: string },
  ): Promise<void> {
    const userId = body.user?.id;
    if (!userId) {
      return;
    }

    const { player: inspector, message: inspectorMessage } =
      await this.fetchInspector(userId);
    if (!inspector) {
      await this.respondFailure(
        client,
        body,
        inspectorMessage ?? 'I could not find your character yet.',
      );
      return;
    }

    const targetRes = await this.dm.getPlayer({
      teamId: selection.teamId || this.teamId!,
      userId: selection.userId,
    });
    const targetRecord = targetRes.data;
    if (!targetRecord) {
      await this.respondFailure(
        client,
        body,
        targetRes.message ?? 'I could not find that adventurer.',
      );
      return;
    }

    const statsMessage = buildPlayerStatsMessage(
      targetRecord as PlayerStatsSource,
      {
        isSelf:
          selection.userId === userId &&
          (selection.teamId || this.teamId) === this.teamId,
      },
    );
    const odds = estimateCombatOdds(inspector, targetRecord);
    const attackerName = inspector.name ?? 'You';
    const defenderName = targetRecord.name ?? 'Unknown Adventurer';
    const blocks = [
      ...toKnownBlocks(statsMessage.blocks),
      ...buildOddsBlocks(attackerName, defenderName, odds),
    ];

    await this.respondWithMessage(client, body, {
      text: statsMessage.text ?? `${defenderName} — inspection result`,
      blocks,
    });
  }

  private async handleMonsterInspect(
    client: WebClient | undefined,
    body: BlockAction,
    monsterId: number,
  ): Promise<void> {
    if (!Number.isFinite(monsterId) || monsterId <= 0) {
      await this.respondFailure(
        client,
        body,
        'That monster is no longer here.',
      );
      return;
    }

    const userId = body.user?.id;
    if (!userId) {
      return;
    }

    const { player: inspector, message: inspectorMessage } =
      await this.fetchInspector(userId);
    if (!inspector) {
      await this.respondFailure(
        client,
        body,
        inspectorMessage ?? 'I could not find your character yet.',
      );
      return;
    }

    const { x, y } = inspector;
    if (typeof x !== 'number' || typeof y !== 'number') {
      await this.respondFailure(
        client,
        body,
        'Unable to determine your location for inspection.',
      );
      return;
    }

    const monster = await this.dm.getMonsterById(monsterId);
    if (!monster) {
      await this.respondFailure(
        client,
        body,
        'That monster is no longer nearby.',
      );
      return;
    }

    const statsMessage = buildMonsterStatsMessage(
      monster as MonsterStatsSource,
    );
    const odds = estimateCombatOdds(inspector, monster as MonsterRecord);
    const attackerName = inspector.name ?? 'You';
    const defenderName = monster.name ?? 'Unknown Monster';
    const blocks = [
      ...toKnownBlocks(statsMessage.blocks),
      ...buildOddsBlocks(attackerName, defenderName, odds),
    ];

    await this.respondWithMessage(client, body, {
      text: statsMessage.text ?? `${defenderName} — inspection result`,
      blocks,
    });
  }

  private async loadInspectableItems(
    inspector: PlayerRecord,
  ): Promise<InspectableItem[]> {
    const items: InspectableItem[] = [];
    const { x, y } = inspector;

    if (typeof x === 'number' && typeof y === 'number') {
      const entities = await this.dm.getLocationEntities({ x, y });
      const locItems = normalizeItems(entities.items);
      if (locItems.length > 0) {
        return locItems;
      }
    }

    return items;
  }

  private async handleItemInspect(
    client: WebClient | undefined,
    body: BlockAction,
    identifier: string,
  ): Promise<void> {
    const userId = body.user?.id;
    if (!userId) {
      return;
    }

    const { player: inspector, message: inspectorMessage } =
      await this.fetchInspector(userId);
    if (!inspector) {
      await this.respondFailure(
        client,
        body,
        inspectorMessage ?? 'I could not find your character yet.',
      );
      return;
    }

    const { worldId, itemId } = parseItemSelection(identifier);
    const nearbyItems = await this.loadInspectableItems(inspector);

    const match = nearbyItems.find((item) => {
      if (worldId !== undefined && String(item.id) === String(worldId)) {
        return true;
      }
      if (itemId !== undefined && item.itemId === itemId) {
        return true;
      }
      return false;
    });

    const detailsRes =
      itemId !== undefined ? await this.dm.getItemDetails(itemId) : undefined;
    const details = detailsRes?.data;
    if (detailsRes && !detailsRes.success && !details) {
      await this.respondFailure(
        client,
        body,
        detailsRes.message ?? 'Failed to load that item.',
      );
      return;
    }

    const message = buildItemInspectMessage(match ?? null, details);
    await this.respondWithMessage(client, body, message);
  }

  public async handleInspectAction(args: InspectActionArgs): Promise<void> {
    const { ack, body, client } = args;
    await ack();

    const stateValues = body.state?.values ?? body.view?.state?.values ?? null;
    if (!stateValues) {
      await this.respondFailure(
        client,
        body,
        'Unable to inspect without a selection.',
      );
      return;
    }

    const selectState = Object.values(stateValues).find(
      (block) => block?.[INSPECT_ACTIONS.TARGET_SELECT],
    );
    const selection = selectState?.[INSPECT_ACTIONS.TARGET_SELECT];

    const targetValue = selection?.selected_option?.value;
    if (!targetValue) {
      await this.respondFailure(client, body, 'No target selected to inspect.');
      return;
    }

    try {
      if (targetValue.startsWith(PLAYER_SELECTION_PREFIX)) {
        const decoded = decodePlayerSelection(targetValue);
        if (!decoded) {
          await this.respondFailure(
            client,
            body,
            'Invalid player selection to inspect.',
          );
          return;
        }
        await this.handlePlayerInspect(client, body, decoded);
        return;
      }

      const [type, identifier] = targetValue.split(':', 2);
      if (!type || !identifier) {
        await this.respondFailure(client, body, 'Invalid inspection target.');
        return;
      }

      if (type === 'M') {
        await this.handleMonsterInspect(client, body, Number(identifier));
        return;
      }

      if (type === 'I') {
        await this.handleItemInspect(client, body, identifier);
        return;
      }

      await this.respondFailure(client, body, 'Unsupported inspection target.');
    } catch (error) {
      await this.respondFailure(
        client,
        body,
        error instanceof Error ? error.message : 'Inspection failed.',
      );
    }
  }
}

export const inspectHandler = new InspectHandler();
