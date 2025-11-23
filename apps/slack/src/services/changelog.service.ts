import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type ChangelogEntry = {
  type: string;
  scope?: string;
  description: string;
  hash: string;
  breaking: boolean;
};

type ChangelogOptions = {
  changelogPath?: string;
};

const SECTION_TYPE_MAP: Record<string, string> = {
  'bug fixes': 'fix',
  features: 'feat',
  'performance improvements': 'perf',
  reverts: 'revert',
  documentation: 'docs',
  styles: 'style',
  'code refactoring': 'refactor',
  tests: 'test',
  'build system': 'build',
  'continuous integration': 'ci',
  chores: 'chore',
};

const parseMarkdownChangelog = (markdown: string): ChangelogEntry[] => {
  const lines = markdown.split(/\r?\n/);
  const entries: ChangelogEntry[] = [];
  let currentSection: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith('### ')) {
      currentSection = line.replace('### ', '').trim().toLowerCase();
      continue;
    }
    if (!line.startsWith('* ')) {
      continue;
    }

    const commitMatch = line.match(/\(\[([0-9a-f]{7,})\]\([^)]+\)\)\s*$/);
    const hash = commitMatch ? commitMatch[1] : '';
    const description = commitMatch
      ? line.slice(0, commitMatch.index).replace(/^\* /, '').trim()
      : line.replace(/^\* /, '').trim();

    entries.push({
      type: currentSection
        ? (SECTION_TYPE_MAP[currentSection] ?? currentSection)
        : 'chore',
      scope: undefined,
      description,
      hash,
      breaking: /BREAKING/i.test(description),
    });
  }

  return entries;
};

const resolveChangelogCandidates = (explicitPath?: string): string[] => {
  if (explicitPath) {
    return [explicitPath];
  }
  return [
    path.resolve(process.cwd(), 'CHANGELOG.md'),
    path.resolve(__dirname, '../../../../CHANGELOG.md'),
  ];
};

export const getRecentChangelogEntries = async (
  limit = 10,
  options: ChangelogOptions = {},
): Promise<ChangelogEntry[]> => {
  const candidates = resolveChangelogCandidates(options.changelogPath);
  for (const candidate of candidates) {
    try {
      const contents = await readFile(candidate, 'utf8');
      const parsed = parseMarkdownChangelog(contents);
      if (parsed.length === 0) {
        continue;
      }
      return parsed.slice(0, limit);
    } catch (err) {
      // ignore missing files and keep iterating, but log for debugging
      console.debug(`Failed to read changelog candidate "${candidate}":`, err);
    }
  }
  return [];
};
