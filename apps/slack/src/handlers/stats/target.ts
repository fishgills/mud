import { COMMANDS } from '../../commands';
import { HandlerContext } from '../types';

const leadingFiller = new Set(['for', 'about', 'of', 'on', 'the']);
const contextWords = new Set(['player', 'character']);
const userIdPattern = /^[UW][A-Z0-9]{2,}$/i;

type ResolveUserId = HandlerContext['resolveUserId'];

export interface ResolvedTarget {
  rawTarget?: string;
  cleanedTarget?: string;
  targetUserId?: string;
  isSelf: boolean;
}

export async function resolveTarget(
  text: string,
  userId: string,
  resolveUserId?: ResolveUserId,
): Promise<ResolvedTarget> {
  const rawTarget = extractTarget(text);

  if (!rawTarget || normalizeSelfReference(rawTarget)) {
    return { isSelf: true };
  }

  const cleanedTarget = sanitizeTargetText(rawTarget);
  const targetUserId = await resolveUserIdFromText({
    rawTarget,
    cleanedTarget,
    resolveUserId,
  });

  return {
    rawTarget,
    cleanedTarget,
    targetUserId,
    isSelf: targetUserId ? targetUserId === userId : false,
  };
}

async function resolveUserIdFromText({
  rawTarget,
  cleanedTarget,
  resolveUserId,
}: {
  rawTarget: string;
  cleanedTarget?: string;
  resolveUserId?: ResolveUserId;
}): Promise<string | undefined> {
  const mentionMatch = rawTarget.match(/^<@([A-Z0-9]+)(?:\|[^>]+)?>$/i);
  if (mentionMatch) {
    return mentionMatch[1].toUpperCase();
  }

  const trimmed = rawTarget.trim();
  if (userIdPattern.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (resolveUserId) {
    try {
      const resolved = await resolveUserId(rawTarget);
      if (resolved) {
        return resolved.toUpperCase();
      }
    } catch {
      // ignore resolution errors
    }
  }

  if (cleanedTarget && userIdPattern.test(cleanedTarget)) {
    return cleanedTarget.toUpperCase();
  }

  return undefined;
}

function extractTarget(text: string): string | undefined {
  const parts = text.trim().split(/\s+/);
  const statsIndex = parts.findIndex(
    (part) => part.toLowerCase() === COMMANDS.STATS,
  );
  if (statsIndex === -1) {
    return undefined;
  }

  const tail = parts.slice(statsIndex + 1).filter(Boolean);
  while (tail.length > 0 && leadingFiller.has(tail[0].toLowerCase())) {
    tail.shift();
  }

  if (tail.length > 1 && contextWords.has(tail[0].toLowerCase())) {
    tail.shift();
  }

  if (tail.length === 0) {
    return undefined;
  }

  return tail.join(' ').trim();
}

function sanitizeTargetText(target: string): string | undefined {
  const cleaned = target
    .replace(/^"|"$/g, '')
    .replace(/[.,!?]+$/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeSelfReference(target: string): boolean {
  const normalized = target.trim().toLowerCase();
  return (
    normalized === 'me' ||
    normalized === 'myself' ||
    normalized === 'self' ||
    normalized === 'mine'
  );
}
