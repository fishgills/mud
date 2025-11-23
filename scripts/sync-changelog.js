const fs = require('node:fs');
const path = require('node:path');

const rootChangelog = path.resolve(__dirname, '..', 'CHANGELOG.md');
const targets = [
  path.resolve(__dirname, '..', 'apps', 'slack', 'CHANGELOG.md'),
];

if (!fs.existsSync(rootChangelog)) {
  console.error('Root CHANGELOG.md not found; skipping sync.');
  process.exit(0);
}

const contents = fs.readFileSync(rootChangelog, 'utf8');
for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

console.log('Synced changelog to:');
targets.forEach((target) =>
  console.log(` - ${path.relative(process.cwd(), target)}`),
);
