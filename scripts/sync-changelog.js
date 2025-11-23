const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const MAX_ENTRIES = Number.parseInt(
  process.env.CHANGELOG_MAX_COMMITS ?? '50',
  10,
);
const GIT_SCAN_MULTIPLIER = 4;

const rootChangelog = path.resolve(__dirname, '..', 'CHANGELOG.md');
const targets = [
  path.resolve(__dirname, '..', 'apps', 'slack', 'CHANGELOG.md'),
];

if (!fs.existsSync(rootChangelog)) {
  console.error('Root CHANGELOG.md not found; skipping sync.');
  process.exit(0);
}

const normalizeNewlines = (text) => text.replace(/\r\n/g, '\n');

const buildCommitOrderMap = (limit) => {
  try {
    const output = execSync(`git log --pretty=format:%H -n ${limit}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const hashes = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const map = new Map();
    hashes.forEach((hash, index) => {
      map.set(hash, index);
      map.set(hash.slice(0, 7), index);
    });
    return map;
  } catch (error) {
    console.warn(
      'Unable to read git history, falling back to file order.',
      error,
    );
    return new Map();
  }
};

const parseEntries = (markdown) => {
  const lines = normalizeNewlines(markdown).split('\n');
  const headerLines = [];
  let index = 0;

  while (index < lines.length && !lines[index].startsWith('### ')) {
    headerLines.push(lines[index]);
    index += 1;
  }

  const entries = [];
  let currentSection = '';
  for (; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    if (!line) {
      continue;
    }
    if (line.startsWith('### ')) {
      currentSection = line.replace(/^###\s+/, '');
      continue;
    }
    if (line.startsWith('* ')) {
      const hashMatch = line.match(/\(\[([0-9a-f]{7,40})\]\([^)]+\)\)\s*$/i);
      entries.push({
        section: currentSection,
        bullet: line,
        hash: hashMatch ? hashMatch[1] : '',
      });
    }
  }

  return { headerLines, entries };
};

const formatEntries = (headerLines, entries, orderMap, maxEntries) => {
  if (!Number.isFinite(maxEntries) || maxEntries <= 0) {
    maxEntries = entries.length;
  }

  const sortedEntries = entries
    .map((entry, index) => ({
      ...entry,
      order: orderMap.has(entry.hash)
        ? orderMap.get(entry.hash)
        : index + orderMap.size,
    }))
    .sort((a, b) => a.order - b.order)
    .slice(0, maxEntries);

  const output = [...headerLines];
  if (output.length === 0 || output[output.length - 1].trim() !== '') {
    output.push('');
  }

  output.push('### Latest Updates');
  output.push('');

  sortedEntries.forEach((entry) => {
    const label = entry.section ? `_${entry.section}_ · ` : '';
    const text = entry.bullet.replace(/^\*+\s*/, '');
    output.push(`* ${label}${text}`);
  });

  output.push('');
  return output.join('\n');
};

const rootContents = fs.readFileSync(rootChangelog, 'utf8');
const { headerLines, entries } = parseEntries(rootContents);
const orderMap = buildCommitOrderMap(
  Math.max(MAX_ENTRIES * GIT_SCAN_MULTIPLIER, 200),
);
const formatted = formatEntries(headerLines, entries, orderMap, MAX_ENTRIES);
fs.writeFileSync(rootChangelog, formatted);

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, formatted);
}

console.log(
  `Sorted and trimmed changelog to ${Math.min(MAX_ENTRIES, entries.length)} entries.`,
);
targets.forEach((target) =>
  console.log(` - ${path.relative(process.cwd(), target)}`),
);
