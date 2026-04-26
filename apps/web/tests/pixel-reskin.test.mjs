/**
 * Unit tests for the pixel-art RPG reskin — happy paths and standard error branches.
 *
 * Run with: node tests/pixel-reskin.test.mjs
 *
 * Tests cover pure logic extracted from changed files. No framework required.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failures.push({ name, message: err.message });
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? 'Assertion failed');
}

function assertEqual(actual, expected, label = '') {
  if (actual !== expected) {
    throw new Error(
      `${label ? label + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertIncludes(haystack, needle, label = '') {
  if (!haystack.includes(needle)) {
    throw new Error(
      `${label ? label + ': ' : ''}expected string to include ${JSON.stringify(needle)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Read source files
// ---------------------------------------------------------------------------

const globalsCss = readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');
const homePage = readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
const topNav = readFileSync(
  path.join(ROOT, 'src/app/components/TopNav.tsx'),
  'utf8',
);
const eventStream = readFileSync(
  path.join(ROOT, 'src/app/components/EventStreamPanel.tsx'),
  'utf8',
);
const itemCard = readFileSync(
  path.join(ROOT, 'src/app/components/ItemCard.tsx'),
  'utf8',
);
const backpackList = readFileSync(
  path.join(ROOT, 'src/app/components/BackpackList.tsx'),
  'utf8',
);
const layoutTsx = readFileSync(path.join(ROOT, 'src/app/layout.tsx'), 'utf8');
const mePage = readFileSync(path.join(ROOT, 'src/app/me/page.tsx'), 'utf8');
const storePage = readFileSync(
  path.join(ROOT, 'src/app/me/store/page.tsx'),
  'utf8',
);
const shopClient = readFileSync(
  path.join(ROOT, 'src/app/me/store/ShopClient.tsx'),
  'utf8',
);
const storeItemSection = readFileSync(
  path.join(ROOT, 'src/app/me/store/StoreItemSection.tsx'),
  'utf8',
);
const inventoryClient = readFileSync(
  path.join(ROOT, 'src/app/me/inventory/InventoryClient.tsx'),
  'utf8',
);
const aboutPage = readFileSync(
  path.join(ROOT, 'src/app/about/page.tsx'),
  'utf8',
);
const supportPage = readFileSync(
  path.join(ROOT, 'src/app/support/page.tsx'),
  'utf8',
);
const privacyPage = readFileSync(
  path.join(ROOT, 'src/app/privacy/page.tsx'),
  'utf8',
);
const termsPage = readFileSync(
  path.join(ROOT, 'src/app/terms/page.tsx'),
  'utf8',
);
const installedPage = readFileSync(
  path.join(ROOT, 'src/app/installed/page.tsx'),
  'utf8',
);

// ---------------------------------------------------------------------------
// Helper: extract CSS classes defined in globals.css
// ---------------------------------------------------------------------------

function getCssClasses(css) {
  // Collect all simple class selectors like .foo or .foo.bar
  const matches = css.match(/\.([\w-]+)/g) ?? [];
  return new Set(matches.map((m) => m.slice(1)));
}

const cssClasses = getCssClasses(globalsCss);

function assertCssClass(cls) {
  assert(cssClasses.has(cls), `CSS class ".${cls}" not found in globals.css`);
}

// ---------------------------------------------------------------------------
// 1. CSS class coverage
// ---------------------------------------------------------------------------

console.log('\n== 1. CSS class coverage ==');

const requiredClasses = [
  'nav',
  'nav-brand',
  'nav-btn',
  'panel',
  'panel-wide',
  'btn',
  'btn-xs',
  'btn-primary',
  'btn-slack',
  'btn-sell',
  'badge',
  'badge-common',
  'badge-rare',
  'badge-epic',
  'badge-legendary',
  'equip-grid',
  'equip-col',
  'equip-slot',
  'slot-label',
  'slot-name',
  'slot-stat',
  'slot-empty',
  'item-card',
  'item-card-top',
  'item-card-name',
  'item-card-price',
  'item-card-desc',
  'item-card-stats',
  'item-card-actions',
  'bp-card',
  'bp-header',
  'bp-name',
  'bp-qty',
  'bp-desc',
  'bp-meta',
  'bp-actions',
  'shop-grid',
  'currency-row',
  'currency-chip',
  'chip-gold',
  'chip-rare',
  'chip-epic',
  'chip-legendary',
  'chip-label',
  'bar-row',
  'bar-key',
  'bar-track',
  'bar-fill',
  'bar-val',
  'notice',
  'notice-success',
  'notice-error',
  'stat-grid',
  'stat-field',
  'stat-key',
  'stat-val',
  'divider',
  'divider-line',
  'divider-glyph',
  'pixel-h1',
  'pixel-h2',
  'pixel-h3',
  'pixel-label',
  'dialog-box',
  'dialog-cursor',
  'events-panel',
  'events-hdr',
  'events-title',
  'events-body',
  'event-line',
  'event-line-type',
  'tab-row',
  'tab-btn',
  'page-text',
  'layout',
  'page-shell',
  'page-layout',
  'inventory-gold',
];

for (const cls of requiredClasses) {
  test(`globals.css defines .${cls}`, () => assertCssClass(cls));
}

// Modifier classes expressed as compound selectors in the CSS
test('globals.css has .nav-btn.active compound selector', () => {
  assertIncludes(globalsCss, '.nav-btn.active', '.nav-btn.active');
});
test('globals.css has .nav-btn.danger compound selector', () => {
  assertIncludes(globalsCss, '.nav-btn.danger', '.nav-btn.danger');
});
test('globals.css has .tab-btn.active compound selector', () => {
  assertIncludes(globalsCss, '.tab-btn.active', '.tab-btn.active');
});

// events-dot status variants (defined as separate classes, not .events-dot.connected)
test('globals.css defines events-dot-connected', () =>
  assertCssClass('events-dot-connected'));
test('globals.css defines events-dot-error', () =>
  assertCssClass('events-dot-error'));
test('globals.css defines events-dot-idle', () =>
  assertCssClass('events-dot-idle'));

// ---------------------------------------------------------------------------
// 2. TypeScript / structural correctness (source-level checks)
// ---------------------------------------------------------------------------

console.log('\n== 2. TypeScript / structural correctness ==');

test('layout.tsx does NOT import Cinzel or Crimson_Text fonts', () => {
  assert(!layoutTsx.includes('Cinzel'), 'Cinzel import found');
  assert(!layoutTsx.includes('Crimson'), 'Crimson_Text import found');
});

test('EventStreamPanel imports useState', () => {
  assertIncludes(eventStream, 'useState', 'useState import');
});

test('EventStreamPanel declares const [open, setOpen] = useState(true)', () => {
  assertIncludes(eventStream, 'useState(true)', 'useState(true)');
  assertIncludes(eventStream, 'open', 'open state variable');
  assertIncludes(eventStream, 'setOpen', 'setOpen setter');
});

test('EventStreamPanel calls stream.subscribe', () => {
  assertIncludes(eventStream, 'stream.subscribe(', 'stream.subscribe call');
});

test('EventStreamPanel calls stream.subscribeStatus', () => {
  assertIncludes(
    eventStream,
    'stream.subscribeStatus(',
    'stream.subscribeStatus call',
  );
});

test('EventStreamPanel has useEffect with [enabled] dependency', () => {
  assertIncludes(eventStream, '[enabled]', 'useEffect dependency');
});

test('ItemCard has normalizeRarity helper with correct signature', () => {
  assertIncludes(
    itemCard,
    'const normalizeRarity = (qualityLabel: string | null | undefined): string =>',
    'normalizeRarity signature',
  );
});

test('ItemCard normalizeRarity handles legendary branch', () => {
  assertIncludes(itemCard, "'legendary'", 'legendary branch');
  assertIncludes(
    itemCard,
    "q.includes('legendary')",
    'legendary includes check',
  );
});

test('ItemCard normalizeRarity handles epic branch', () => {
  assertIncludes(itemCard, "'epic'", 'epic branch');
  assertIncludes(itemCard, "q.includes('epic')", 'epic includes check');
});

test('ItemCard normalizeRarity handles rare branch', () => {
  assertIncludes(itemCard, "'rare'", 'rare branch');
  assertIncludes(itemCard, "q.includes('rare')", 'rare includes check');
});

test('ItemCard normalizeRarity falls back to common', () => {
  assertIncludes(itemCard, "'common'", 'common fallback');
});

test('ItemCard slot variant returns a React fragment (<>)', () => {
  assertIncludes(itemCard, "if (variant === 'slot')", 'slot branch');
  // Fragment opening tag should be present after the slot check
  const slotIdx = itemCard.indexOf("if (variant === 'slot')");
  const fragIdx = itemCard.indexOf('<>', slotIdx);
  assert(fragIdx > slotIdx, 'React fragment <> found after slot branch');
});

test('ItemCard has inventory variant branch', () => {
  assertIncludes(itemCard, "if (variant === 'inventory')", 'inventory branch');
});

test('ItemCard shop variant is the final fallback', () => {
  // The shop variant is the else/fallback — there is no explicit if for it
  assertIncludes(itemCard, '// shop variant', 'shop fallback comment');
});

test('me/page.tsx does NOT reference renderTicketIcon', () => {
  assert(
    !mePage.includes('renderTicketIcon'),
    'renderTicketIcon still referenced in me/page.tsx',
  );
});

test('me/store/page.tsx does NOT reference SectionDivider', () => {
  assert(
    !storePage.includes('SectionDivider'),
    'SectionDivider still referenced in me/store/page.tsx',
  );
});

test('me/store/page.tsx uses PixelDivider', () => {
  assertIncludes(storePage, 'PixelDivider', 'PixelDivider in store page');
});

test('ShopClient declares tab state with buy/sell union type', () => {
  assertIncludes(
    shopClient,
    "useState<'buy' | 'sell'>('buy')",
    'tab useState declaration',
  );
});

test('ShopClient renders FOR SALE tab button', () => {
  assertIncludes(shopClient, 'FOR SALE', 'FOR SALE tab label');
});

test('ShopClient renders SELL ITEMS tab button', () => {
  assertIncludes(shopClient, 'SELL ITEMS', 'SELL ITEMS tab label');
});

test('ShopClient conditionally renders buy section on tab === buy', () => {
  assertIncludes(shopClient, "tab === 'buy'", 'buy tab conditional');
});

test('ShopClient conditionally renders sell section on tab === sell', () => {
  assertIncludes(shopClient, "tab === 'sell'", 'sell tab conditional');
});

// ---------------------------------------------------------------------------
// 3. Content preservation — static pages
// ---------------------------------------------------------------------------

console.log('\n== 3. Content preservation ==');

test('about page has "HOW IT WORKS" section', () => {
  assertIncludes(aboutPage, 'HOW IT WORKS', 'HOW IT WORKS section');
});

test('about page has "THE WEB APP" section', () => {
  assertIncludes(aboutPage, 'THE WEB APP', 'THE WEB APP section');
});

test('about page has "BUILT BY" section', () => {
  assertIncludes(aboutPage, 'BUILT BY', 'BUILT BY section');
});

test('about page describes BattleForge as Slack DM game', () => {
  assertIncludes(aboutPage, 'Slack', 'Slack reference in about page');
});

test('support page has contact email', () => {
  assertIncludes(supportPage, 'support@battleforge.app', 'contact email');
});

test('privacy page has "WHAT DATA WE COLLECT" section', () => {
  assertIncludes(
    privacyPage,
    'WHAT DATA WE COLLECT',
    'What we collect section',
  );
});

test('privacy page has "HOW MESSAGES ARE USED" section', () => {
  assertIncludes(privacyPage, 'HOW MESSAGES ARE USED', 'How we use it section');
});

test('privacy page has "DATA RETENTION" section', () => {
  assertIncludes(privacyPage, 'DATA RETENTION', 'Data retention section');
});

test('privacy page has "CONTACT" section', () => {
  assertIncludes(privacyPage, 'CONTACT', 'Contact section');
});

test('privacy page has support email', () => {
  assertIncludes(
    privacyPage,
    'support@battleforge.app',
    'privacy contact email',
  );
});

test('terms page has terms content', () => {
  assertIncludes(termsPage, 'BattleForge is provided as-is', 'terms content');
});

// ---------------------------------------------------------------------------
// 4. Slack OAuth URL
// ---------------------------------------------------------------------------

console.log('\n== 4. Add to Slack button ==');

test('home page Add to Slack button routes through Bolt install endpoint', () => {
  assertIncludes(
    homePage,
    'https://slack.battleforge.app/slack/install',
    'Bolt install URL',
  );
});

test('home page Add to Slack button does not use a hardcoded Slack OAuth URL', () => {
  if (homePage.includes('slack.com/oauth/v2/authorize')) {
    throw new Error(
      'page.tsx still contains a hardcoded Slack OAuth URL — use /slack/install instead',
    );
  }
});

// ---------------------------------------------------------------------------
// 4b. /installed success page
// ---------------------------------------------------------------------------

console.log('\n== 4b. /installed success page ==');

test('installed page renders QUEST UNLOCKED heading', () => {
  assertIncludes(installedPage, 'QUEST UNLOCKED', 'heading');
});

test('installed page uses panel and pixel-h1 design classes', () => {
  assertIncludes(installedPage, 'panel', 'panel class');
  assertIncludes(installedPage, 'pixel-h1', 'pixel-h1 class');
});

test('installed page has dialog-box flavor text', () => {
  assertIncludes(installedPage, 'dialog-box', 'dialog-box class');
  assertIncludes(installedPage, 'BattleForge has joined your', 'flavor text');
});

test('installed page lists first commands: new, raid, attack, stats', () => {
  assertIncludes(installedPage, "'new'", 'new command');
  assertIncludes(installedPage, "'raid'", 'raid command');
  assertIncludes(installedPage, "'attack'", 'attack command');
  assertIncludes(installedPage, "'stats'", 'stats command');
});

test('installed page has Open Slack CTA linking to slack://open', () => {
  assertIncludes(installedPage, 'slack://open', 'Open Slack href');
  assertIncludes(installedPage, 'OPEN SLACK', 'Open Slack label');
});

test('installed page has back to home link', () => {
  assertIncludes(installedPage, 'BACK TO HOME', 'back to home link');
});

test('installed page uses stat-grid for command reference', () => {
  assertIncludes(installedPage, 'stat-grid', 'stat-grid class');
  assertIncludes(installedPage, 'stat-field', 'stat-field class');
});

// ---------------------------------------------------------------------------
// 5. JSX class usage matches CSS definitions
// ---------------------------------------------------------------------------

console.log('\n== 5. JSX classes used in components exist in globals.css ==');

// Key classes referenced in JSX — spot-check the most critical ones
const jsxClassChecks = [
  // TopNav
  { file: topNav, name: 'TopNav', cls: 'nav' },
  { file: topNav, name: 'TopNav', cls: 'nav-brand' },
  { file: topNav, name: 'TopNav', cls: 'nav-btn' },
  // EventStreamPanel
  { file: eventStream, name: 'EventStreamPanel', cls: 'events-panel' },
  { file: eventStream, name: 'EventStreamPanel', cls: 'events-hdr' },
  { file: eventStream, name: 'EventStreamPanel', cls: 'events-title' },
  { file: eventStream, name: 'EventStreamPanel', cls: 'events-body' },
  { file: eventStream, name: 'EventStreamPanel', cls: 'event-line' },
  { file: eventStream, name: 'EventStreamPanel', cls: 'btn-xs' },
  // ItemCard
  { file: itemCard, name: 'ItemCard', cls: 'bp-card' },
  { file: itemCard, name: 'ItemCard', cls: 'bp-header' },
  { file: itemCard, name: 'ItemCard', cls: 'bp-name' },
  { file: itemCard, name: 'ItemCard', cls: 'bp-qty' },
  { file: itemCard, name: 'ItemCard', cls: 'bp-desc' },
  { file: itemCard, name: 'ItemCard', cls: 'bp-meta' },
  { file: itemCard, name: 'ItemCard', cls: 'bp-actions' },
  { file: itemCard, name: 'ItemCard', cls: 'item-card' },
  { file: itemCard, name: 'ItemCard', cls: 'item-card-top' },
  { file: itemCard, name: 'ItemCard', cls: 'item-card-name' },
  { file: itemCard, name: 'ItemCard', cls: 'item-card-desc' },
  { file: itemCard, name: 'ItemCard', cls: 'item-card-stats' },
  { file: itemCard, name: 'ItemCard', cls: 'item-card-actions' },
  { file: itemCard, name: 'ItemCard', cls: 'slot-name' },
  { file: itemCard, name: 'ItemCard', cls: 'slot-stat' },
  { file: itemCard, name: 'ItemCard', cls: 'inventory-gold' },
  // ShopClient
  { file: shopClient, name: 'ShopClient', cls: 'tab-row' },
  { file: shopClient, name: 'ShopClient', cls: 'tab-btn' },
  { file: shopClient, name: 'ShopClient', cls: 'currency-chip' },
  { file: shopClient, name: 'ShopClient', cls: 'chip-gold' },
  { file: shopClient, name: 'ShopClient', cls: 'notice' },
  { file: shopClient, name: 'ShopClient', cls: 'notice-success' },
  { file: shopClient, name: 'ShopClient', cls: 'notice-error' },
  // StoreItemSection
  { file: storeItemSection, name: 'StoreItemSection', cls: 'pixel-h3' },
  { file: storeItemSection, name: 'StoreItemSection', cls: 'shop-grid' },
  // InventoryClient
  { file: inventoryClient, name: 'InventoryClient', cls: 'equip-grid' },
  { file: inventoryClient, name: 'InventoryClient', cls: 'equip-col' },
  { file: inventoryClient, name: 'InventoryClient', cls: 'equip-slot' },
  { file: inventoryClient, name: 'InventoryClient', cls: 'slot-label' },
  { file: inventoryClient, name: 'InventoryClient', cls: 'slot-empty' },
  { file: inventoryClient, name: 'InventoryClient', cls: 'pixel-h3' },
  { file: inventoryClient, name: 'InventoryClient', cls: 'btn-xs' },
  // me/page
  { file: mePage, name: 'me/page', cls: 'currency-row' },
  { file: mePage, name: 'me/page', cls: 'currency-chip' },
  { file: mePage, name: 'me/page', cls: 'chip-gold' },
  { file: mePage, name: 'me/page', cls: 'bar-row' },
  { file: mePage, name: 'me/page', cls: 'bar-track' },
  { file: mePage, name: 'me/page', cls: 'bar-fill' },
  { file: mePage, name: 'me/page', cls: 'bar-val' },
  { file: mePage, name: 'me/page', cls: 'stat-grid' },
  { file: mePage, name: 'me/page', cls: 'stat-field' },
  { file: mePage, name: 'me/page', cls: 'stat-key' },
  { file: mePage, name: 'me/page', cls: 'stat-val' },
  { file: mePage, name: 'me/page', cls: 'pixel-h1' },
  { file: mePage, name: 'me/page', cls: 'pixel-h3' },
  { file: mePage, name: 'me/page', cls: 'panel' },
  { file: mePage, name: 'me/page', cls: 'panel-wide' },
  // home page
  { file: homePage, name: 'home page', cls: 'dialog-box' },
  { file: homePage, name: 'home page', cls: 'dialog-cursor' },
  { file: homePage, name: 'home page', cls: 'divider' },
  { file: homePage, name: 'home page', cls: 'divider-line' },
  { file: homePage, name: 'home page', cls: 'divider-glyph' },
  { file: homePage, name: 'home page', cls: 'btn-slack' },
];

for (const { file, name, cls } of jsxClassChecks) {
  test(`${name} uses .${cls} which is defined in globals.css`, () => {
    assertIncludes(file, cls, `"${cls}" referenced in source`);
    assertCssClass(cls);
  });
}

// ---------------------------------------------------------------------------
// 6. normalizeRarity pure-function behaviour (inline re-implementation)
// ---------------------------------------------------------------------------

console.log('\n== 6. normalizeRarity logic ==');

// Extract and re-implement for unit testing
const normalizeRarity = (qualityLabel) => {
  const q = qualityLabel?.toLowerCase() ?? '';
  if (q.includes('legendary')) return 'legendary';
  if (q.includes('epic')) return 'epic';
  if (q.includes('rare')) return 'rare';
  return 'common';
};

test('normalizeRarity returns "legendary" for "Legendary"', () => {
  assertEqual(normalizeRarity('Legendary'), 'legendary');
});

test('normalizeRarity returns "legendary" for "legendary item"', () => {
  assertEqual(normalizeRarity('legendary item'), 'legendary');
});

test('normalizeRarity returns "epic" for "Epic"', () => {
  assertEqual(normalizeRarity('Epic'), 'epic');
});

test('normalizeRarity returns "rare" for "Rare"', () => {
  assertEqual(normalizeRarity('Rare'), 'rare');
});

test('normalizeRarity returns "common" for "Common"', () => {
  assertEqual(normalizeRarity('Common'), 'common');
});

test('normalizeRarity returns "common" for null', () => {
  assertEqual(normalizeRarity(null), 'common');
});

test('normalizeRarity returns "common" for undefined', () => {
  assertEqual(normalizeRarity(undefined), 'common');
});

test('normalizeRarity returns "common" for empty string', () => {
  assertEqual(normalizeRarity(''), 'common');
});

test('normalizeRarity prioritises legendary over epic (compound label)', () => {
  assertEqual(normalizeRarity('legendary epic'), 'legendary');
});

// ---------------------------------------------------------------------------
// 7. formatCountdown logic (extracted from ShopClient)
// ---------------------------------------------------------------------------

console.log('\n== 7. formatCountdown logic ==');

const formatCountdown = (milliseconds) => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '0:00';
  }
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
};

test('formatCountdown returns "0:00" for 0ms', () => {
  assertEqual(formatCountdown(0), '0:00');
});

test('formatCountdown returns "0:00" for negative ms', () => {
  assertEqual(formatCountdown(-1000), '0:00');
});

test('formatCountdown returns "0:00" for non-finite', () => {
  assertEqual(formatCountdown(Infinity), '0:00');
});

test('formatCountdown returns "0:01" for 1000ms', () => {
  assertEqual(formatCountdown(1000), '0:01');
});

test('formatCountdown returns "1:00" for 60000ms', () => {
  assertEqual(formatCountdown(60000), '1:00');
});

test('formatCountdown pads seconds to 2 digits', () => {
  assertEqual(formatCountdown(65000), '1:05');
});

test('formatCountdown formats hours correctly for 3600000ms', () => {
  assertEqual(formatCountdown(3600000), '1:00:00');
});

test('formatCountdown formats hours+minutes+seconds', () => {
  assertEqual(formatCountdown(3665000), '1:01:05');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n==================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log('\nFailed tests:');
  for (const f of failures) {
    console.log(`  - ${f.name}`);
    console.log(`    ${f.message}`);
  }
  process.exit(1);
} else {
  console.log('All tests passed.');
}
