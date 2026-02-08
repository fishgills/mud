const SLACK_TEXT_LIMIT = 3000;
const SLACK_BLOCKS_LIMIT = 50;

const truncateText = (text: string, limit: number): string => {
  if (text.length <= limit) return text;
  const suffix = '...';
  return `${text.slice(0, limit - suffix.length)}${suffix}`;
};

const truncateTextObject = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return {
      ...record,
      text: truncateText(record.text, SLACK_TEXT_LIMIT),
    };
  }
  return value;
};

const truncateBlock = (
  block: Record<string, unknown>,
): Record<string, unknown> => {
  const next = { ...block };
  if (typeof next.text === 'string') {
    next.text = truncateText(next.text, SLACK_TEXT_LIMIT);
  } else if (next.text && typeof next.text === 'object') {
    next.text = truncateTextObject(next.text);
  }
  if (Array.isArray(next.fields)) {
    next.fields = next.fields.map((field) => truncateTextObject(field));
  }
  if (Array.isArray(next.elements)) {
    next.elements = next.elements.map((element) => truncateTextObject(element));
  }
  if (next.label && typeof next.label === 'object') {
    next.label = truncateTextObject(next.label);
  }
  if (next.placeholder && typeof next.placeholder === 'object') {
    next.placeholder = truncateTextObject(next.placeholder);
  }
  return next;
};

const truncateBlocks = (
  blocks: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> => {
  return blocks
    .slice(0, SLACK_BLOCKS_LIMIT)
    .map((block) => truncateBlock(block));
};

export const truncateSlackPayload = (
  message: string,
  blocks?: Array<Record<string, unknown>>,
): { text: string; blocks?: Array<Record<string, unknown>> } => {
  const text = truncateText(message, SLACK_TEXT_LIMIT);
  if (!blocks || blocks.length === 0) {
    return { text };
  }
  return { text, blocks: truncateBlocks(blocks) };
};
