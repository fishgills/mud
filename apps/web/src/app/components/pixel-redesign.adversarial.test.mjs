/**
 * Adversarial tests for the pixel-art RPG redesign.
 * Tests edge cases of the pure functions extracted from the changed components.
 * Run with: node pixel-redesign.adversarial.test.mjs
 * (No build step needed — only pure JS logic is tested here.)
 */

import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inline the pure functions under test (copied verbatim from source so we
// don't need a TS/JSX transpiler pipeline).
// ---------------------------------------------------------------------------

/** From ItemCard.tsx and InventoryClient.tsx (identical implementations) */
const normalizeRarity = (qualityLabel) => {
  const q = qualityLabel?.toLowerCase() ?? '';
  if (q.includes('legendary')) return 'legendary';
  if (q.includes('epic')) return 'epic';
  if (q.includes('rare')) return 'rare';
  return 'common';
};

/** From ItemCard.tsx */
const formatSellPrice = (value) => {
  if (value == null) return '—';
  return `${value} gold`;
};

/** From ShopClient.tsx */
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

/** From ShopClient.tsx */
const resolveTicketInfo = (ticketRequirement) => {
  if (!ticketRequirement) return null;
  const normalized = ticketRequirement.toLowerCase();
  if (normalized === 'rare')      return { key: 'rare',      label: 'Rare ticket' };
  if (normalized === 'epic')      return { key: 'epic',      label: 'Epic ticket' };
  if (normalized === 'legendary') return { key: 'legendary', label: 'Legendary ticket' };
  return { key: normalized, label: `${ticketRequirement} ticket` };
};

/** HP percentage logic from me/page.tsx */
const computeHpPct = (hp, maxHp) => {
  const safeHp    = hp    ?? 0;
  const safeMaxHp = maxHp ?? 1;
  return safeMaxHp > 0
    ? Math.min(100, Math.max(0, (safeHp / safeMaxHp) * 100))
    : 0;
};

// ---------------------------------------------------------------------------
// Test runner helpers
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

// ---------------------------------------------------------------------------
// 1. normalizeRarity — null / undefined / empty / unknown inputs
// ---------------------------------------------------------------------------
console.log('\n--- normalizeRarity edge cases ---');

test('null qualityLabel returns common', () => {
  assert.equal(normalizeRarity(null), 'common');
});

test('undefined qualityLabel returns common', () => {
  assert.equal(normalizeRarity(undefined), 'common');
});

test('empty string qualityLabel returns common', () => {
  assert.equal(normalizeRarity(''), 'common');
});

test('whitespace-only qualityLabel returns common', () => {
  assert.equal(normalizeRarity('   '), 'common');
});

test('unknown value "Mythic" returns common', () => {
  assert.equal(normalizeRarity('Mythic'), 'common');
});

test('"LEGENDARY" uppercase maps to legendary (via toLowerCase)', () => {
  assert.equal(normalizeRarity('LEGENDARY'), 'legendary');
});

test('"EPIC" uppercase maps to epic', () => {
  assert.equal(normalizeRarity('EPIC'), 'epic');
});

test('"RARE" uppercase maps to rare', () => {
  assert.equal(normalizeRarity('RARE'), 'rare');
});

test('"Legendary Item" (substring) maps to legendary', () => {
  assert.equal(normalizeRarity('Legendary Item'), 'legendary');
});

test('"Super Rare" (substring) maps to rare', () => {
  assert.equal(normalizeRarity('Super Rare'), 'rare');
});

test('"Epic Grade" (substring) maps to epic', () => {
  assert.equal(normalizeRarity('Epic Grade'), 'epic');
});

// Check that normalizeRarity NEVER returns undefined or produces a
// "rarity-undefined" class name — the class template is `rarity-${rarity}`.
test('return value is always a non-empty string (never undefined)', () => {
  const inputs = [null, undefined, '', 'Mythic', 'LEGENDARY', 'RARE', 'EPIC', '🔥'];
  for (const input of inputs) {
    const result = normalizeRarity(input);
    assert.ok(typeof result === 'string' && result.length > 0,
      `Expected non-empty string for input ${JSON.stringify(input)}, got ${JSON.stringify(result)}`);
    assert.notEqual(result, 'undefined',
      `normalizeRarity returned the string "undefined" for input ${JSON.stringify(input)}`);
  }
});

test('Unicode / emoji input returns common without throwing', () => {
  assert.equal(normalizeRarity('🔥🗡️'), 'common');
});

test('Very long input string (10 000 chars) returns without throwing', () => {
  const long = 'x'.repeat(10_000);
  const result = normalizeRarity(long);
  assert.equal(result, 'common');
});

test('Input containing "legendary" embedded in HTML-like string', () => {
  // Injection attempt: ensure .includes() is safe (it is — it's a string method,
  // not eval'd), and the result is still 'legendary'.
  assert.equal(normalizeRarity('<script>legendary</script>'), 'legendary');
});

// ---------------------------------------------------------------------------
// 2. formatSellPrice — boundary / null inputs
// ---------------------------------------------------------------------------
console.log('\n--- formatSellPrice edge cases ---');

test('null value returns em-dash', () => {
  assert.equal(formatSellPrice(null), '—');
});

test('undefined value returns em-dash', () => {
  assert.equal(formatSellPrice(undefined), '—');
});

test('0 gold is displayed (not treated as falsy null)', () => {
  // 0 is a valid sell price; the guard is `== null` so 0 should pass through.
  assert.equal(formatSellPrice(0), '0 gold');
});

test('negative sell price is formatted without crashing', () => {
  assert.equal(formatSellPrice(-5), '-5 gold');
});

test('very large number does not throw', () => {
  const result = formatSellPrice(Number.MAX_SAFE_INTEGER);
  assert.ok(result.includes('gold'));
});

// ---------------------------------------------------------------------------
// 3. HP bar computation — boundary / null inputs
// ---------------------------------------------------------------------------
console.log('\n--- HP bar (computeHpPct) edge cases ---');

test('null hp and null maxHp defaults to 0%', () => {
  assert.equal(computeHpPct(null, null), 0);
});

test('undefined hp defaults to 0', () => {
  // With hp=undefined, safeHp=0, so result is 0/maxHp = 0%
  assert.equal(computeHpPct(undefined, 100), 0);
});

test('maxHp = 0 guard returns 0 (no division by zero)', () => {
  // safeMaxHp = 0 ?? 1 = 0... wait, 0 is falsy for ??, no — ?? only triggers on null/undefined.
  // So maxHp=0 means safeMaxHp=0, and the guard `safeMaxHp > 0` returns 0.
  const safeMaxHp = 0 ?? 1; // = 0 (because 0 is not null/undefined)
  assert.equal(safeMaxHp, 0, 'Precondition: ?? does not coerce 0 to 1');
  assert.equal(computeHpPct(50, 0), 0, 'maxHp=0 should return 0%, not NaN or Infinity');
});

test('hp > maxHp (overhealed) is capped at 100%', () => {
  assert.equal(computeHpPct(150, 100), 100);
});

test('hp = 0 returns exactly 0%', () => {
  assert.equal(computeHpPct(0, 100), 0);
});

test('hp = maxHp returns exactly 100%', () => {
  assert.equal(computeHpPct(100, 100), 100);
});

test('negative hp returns 0% (Math.max(0, ...) guard)', () => {
  assert.equal(computeHpPct(-10, 100), 0);
});

test('NaN hp input does not produce NaN output — returns 0', () => {
  const result = computeHpPct(NaN, 100);
  // NaN/100 = NaN; Math.max(0, NaN) = NaN; the guard safeMaxHp > 0 is true,
  // so the result will be NaN unless there's an extra guard.
  // This is intentionally checking whether the current code handles NaN.
  // Mark as known behavior: if result is NaN, that's a real gap.
  assert.ok(!Number.isNaN(result) || result === 0,
    `NaN hp resulted in NaN hpPct — no NaN guard exists in the current implementation`);
});

// ---------------------------------------------------------------------------
// 4. formatCountdown — boundary / adversarial inputs
// ---------------------------------------------------------------------------
console.log('\n--- formatCountdown edge cases ---');

test('0 ms returns "0:00"', () => {
  assert.equal(formatCountdown(0), '0:00');
});

test('negative ms returns "0:00"', () => {
  assert.equal(formatCountdown(-1000), '0:00');
});

test('NaN returns "0:00"', () => {
  assert.equal(formatCountdown(NaN), '0:00');
});

test('Infinity returns "0:00"', () => {
  assert.equal(formatCountdown(Infinity), '0:00');
});

test('-Infinity returns "0:00"', () => {
  assert.equal(formatCountdown(-Infinity), '0:00');
});

test('exactly 1 minute (60 000 ms) returns "1:00"', () => {
  assert.equal(formatCountdown(60_000), '1:00');
});

test('59 999 ms rounds up to 1:00 (Math.ceil)', () => {
  assert.equal(formatCountdown(59_999), '1:00');
});

test('1 ms rounds up to 0:01', () => {
  assert.equal(formatCountdown(1), '0:01');
});

test('1 hour exactly returns "1:00:00"', () => {
  assert.equal(formatCountdown(3_600_000), '1:00:00');
});

test('1 hour 1 minute 1 second returns "1:01:01"', () => {
  assert.equal(formatCountdown(3_661_000), '1:01:01');
});

test('very large value (1 week) does not throw', () => {
  const result = formatCountdown(7 * 24 * 60 * 60 * 1000);
  assert.ok(typeof result === 'string' && result.length > 0);
});

// ---------------------------------------------------------------------------
// 5. resolveTicketInfo — edge cases
// ---------------------------------------------------------------------------
console.log('\n--- resolveTicketInfo edge cases ---');

test('null ticketRequirement returns null', () => {
  assert.equal(resolveTicketInfo(null), null);
});

test('undefined ticketRequirement returns null', () => {
  assert.equal(resolveTicketInfo(undefined), null);
});

test('empty string ticketRequirement returns null (falsy)', () => {
  assert.equal(resolveTicketInfo(''), null);
});

test('"RARE" uppercase is normalized to rare key', () => {
  const result = resolveTicketInfo('RARE');
  assert.equal(result?.key, 'rare');
});

test('"EPIC" uppercase is normalized to epic key', () => {
  const result = resolveTicketInfo('EPIC');
  assert.equal(result?.key, 'epic');
});

test('"LEGENDARY" uppercase is normalized to legendary key', () => {
  const result = resolveTicketInfo('LEGENDARY');
  assert.equal(result?.key, 'legendary');
});

test('unknown ticket type returns key as lowercase of input', () => {
  const result = resolveTicketInfo('Mythic');
  assert.equal(result?.key, 'mythic');
  assert.equal(result?.label, 'Mythic ticket');
});

test('ticket key is safe for CSS class construction (no spaces/injection)', () => {
  // The key is used in className={`ticket-icon ticket-icon-${ticketInfo.key}`}
  // A ticket requirement with spaces would produce a broken class name.
  const result = resolveTicketInfo('super rare');
  // 'super rare' is not one of the three recognized values, so it falls through.
  // The key would be 'super rare' — two words, which would break the CSS class.
  assert.ok(
    !result?.key.includes(' '),
    `CSS class would be broken: ticket-icon-${result?.key} contains a space`
  );
});

// ---------------------------------------------------------------------------
// 6. EventStreamPanel — hooks-ordering check (static analysis)
// ---------------------------------------------------------------------------
// This cannot be run as React but we can verify the source file ordering
// by reading the file content and checking line positions.
console.log('\n--- EventStreamPanel hooks-order check (static analysis) ---');

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const eventPanelSrc = readFileSync(
  path.join(__dirname, 'EventStreamPanel.tsx'),
  'utf8',
);

test('useState calls appear before "if (!enabled)" early return', () => {
  // The early return may be on two lines: `if (!enabled) {` then `return null;`
  // We search for the `if (!enabled)` guard block as the sentinel.
  const useStateIndex   = eventPanelSrc.indexOf('useState(');
  // Find the conditional block that gates the whole render on `enabled`
  // It appears outside of any useEffect (not `if (!enabled || typeof window`)
  // Locate the standalone `if (!enabled)` that is NOT inside a useEffect.
  // We can find it by looking past the useEffect's version.
  const useEffectEnabled = eventPanelSrc.indexOf('if (!enabled || typeof window');
  const earlyReturnIndex = eventPanelSrc.indexOf('if (!enabled)', useEffectEnabled + 1);
  assert.ok(useStateIndex !== -1,  'useState call not found in EventStreamPanel');
  assert.ok(earlyReturnIndex !== -1, 'Early return guard "if (!enabled)" not found in EventStreamPanel');
  assert.ok(
    useStateIndex < earlyReturnIndex,
    `HOOKS VIOLATION: "if (!enabled)" early return (char ${earlyReturnIndex}) appears ` +
    `BEFORE the first useState call (char ${useStateIndex}). ` +
    `This violates Rules of Hooks.`
  );
});

test('All useState declarations are before the "if (!enabled)" early return', () => {
  const lines = eventPanelSrc.split('\n');
  let lastUseStateLine = -1;
  let earlyReturnLine  = -1;
  // Find the early return guard that is NOT inside a useEffect callback
  // The useEffect-internal guard is: `if (!enabled || typeof window`
  // The component-level guard is a standalone `if (!enabled) {`
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('useState('))                          lastUseStateLine = i;
    if (lines[i].includes('if (!enabled)') &&
        !lines[i].includes('typeof window'))                     earlyReturnLine  = i;
  }
  assert.ok(lastUseStateLine !== -1, 'No useState found in EventStreamPanel');
  assert.ok(earlyReturnLine  !== -1, 'No early return guard found in EventStreamPanel');
  assert.ok(
    lastUseStateLine < earlyReturnLine,
    `HOOKS VIOLATION: Last useState is on line ${lastUseStateLine + 1} but ` +
    `early return is on line ${earlyReturnLine + 1}. ` +
    `All hooks must be called unconditionally before any conditional return.`
  );
});

// ---------------------------------------------------------------------------
// 7. globals.css — @import ordering check
// ---------------------------------------------------------------------------
console.log('\n--- globals.css @import order check ---');

const globalsCssSrc = readFileSync(
  path.join(__dirname, '..', 'globals.css'),
  'utf8',
);

test('Google Fonts @import is the first statement in globals.css', () => {
  const lines = globalsCssSrc.split('\n').filter(l => l.trim().length > 0);
  assert.ok(
    lines[0].includes('fonts.googleapis.com'),
    `Expected Google Fonts @import to be first non-blank line, got: ${lines[0]}`
  );
});

test('@import "tailwindcss" comes after Google Fonts @import', () => {
  const lines = globalsCssSrc.split('\n').filter(l => l.trim().length > 0);
  const fontsIdx = lines.findIndex(l => l.includes('fonts.googleapis.com'));
  const tailwindIdx = lines.findIndex(l => l.includes("'tailwindcss'") || l.includes('"tailwindcss"'));
  assert.ok(fontsIdx !== -1,   'Google Fonts @import not found');
  assert.ok(tailwindIdx !== -1, 'tailwindcss @import not found');
  assert.ok(
    fontsIdx < tailwindIdx,
    `tailwindcss @import (line ${tailwindIdx + 1}) must come after Fonts (line ${fontsIdx + 1})`
  );
});

// ---------------------------------------------------------------------------
// 8. CSS class consistency — .nav-btn.danger compound selector check
// ---------------------------------------------------------------------------
console.log('\n--- TopNav CSS class consistency ---');

const topNavSrc = readFileSync(
  path.join(__dirname, 'TopNav.tsx'),
  'utf8',
);

test('TopNav logout button uses "nav-btn danger" (two separate classes)', () => {
  assert.ok(
    topNavSrc.includes('"nav-btn danger"'),
    'Expected className="nav-btn danger" in TopNav — compound CSS selector .nav-btn.danger requires both classes'
  );
});

test('TopNav logout button does NOT use "nav-btn-danger" (hyphenated — wrong class)', () => {
  assert.ok(
    !topNavSrc.includes('"nav-btn-danger"'),
    'Found "nav-btn-danger" — this is a different class from .nav-btn.danger'
  );
});

// ---------------------------------------------------------------------------
// 9. EventStreamPanel clear button class check
// ---------------------------------------------------------------------------
console.log('\n--- EventStreamPanel clear button class check ---');

test('Clear button uses "btn btn-xs" (pixel button classes, not old class)', () => {
  assert.ok(
    eventPanelSrc.includes('"btn btn-xs"'),
    'Expected className="btn btn-xs" on clear button in EventStreamPanel'
  );
});

test('Clear button does NOT use old ".event-stream-clear" class', () => {
  assert.ok(
    !eventPanelSrc.includes('event-stream-clear'),
    'Found legacy "event-stream-clear" class in EventStreamPanel — should be "btn btn-xs"'
  );
});

// ---------------------------------------------------------------------------
// 10. ticket-icon and ticket-icon-svg classes present in ShopClient
// ---------------------------------------------------------------------------
console.log('\n--- ShopClient ticket-icon class check ---');

const shopClientSrc = readFileSync(
  path.join(__dirname, '..', 'me', 'store', 'ShopClient.tsx'),
  'utf8',
);

test('ShopClient uses ticket-icon class (still expected in restyled version)', () => {
  // These classes ARE present and are used for the SVG ticket icon.
  // The question from the brief is whether they are STILL used after the edit.
  assert.ok(
    shopClientSrc.includes('ticket-icon'),
    'ticket-icon class not found — may have been removed without CSS update'
  );
});

test('ShopClient uses ticket-icon-svg class', () => {
  assert.ok(
    shopClientSrc.includes('ticket-icon-svg'),
    'ticket-icon-svg class not found'
  );
});

// Check that these classes are actually defined in globals.css
test('ticket-icon CSS class is defined in globals.css', () => {
  assert.ok(
    globalsCssSrc.includes('.ticket-icon'),
    'WARNING: .ticket-icon is used in ShopClient.tsx but NOT defined in globals.css — styles will be missing'
  );
});

test('ticket-icon-svg CSS class is defined in globals.css', () => {
  assert.ok(
    globalsCssSrc.includes('.ticket-icon-svg'),
    'WARNING: .ticket-icon-svg is used in ShopClient.tsx but NOT defined in globals.css — styles will be missing'
  );
});

// ---------------------------------------------------------------------------
// 11. ItemCard slot variant — fragment key warning check
// ---------------------------------------------------------------------------
console.log('\n--- ItemCard slot variant fragment / key check ---');

const itemCardSrc = readFileSync(
  path.join(__dirname, 'ItemCard.tsx'),
  'utf8',
);

test('ItemCard slot variant uses a fragment <> not a keyed wrapper', () => {
  // Verify the slot path returns a fragment
  const slotVariantSection = itemCardSrc.slice(
    itemCardSrc.indexOf("variant === 'slot'"),
    itemCardSrc.indexOf("variant === 'inventory'"),
  );
  assert.ok(slotVariantSection.includes('<>'), 'Expected fragment <> in slot variant');
});

test('InventoryClient renderSlot wraps ItemCard in a div with key (not on fragment)', () => {
  const inventoryClientSrc = readFileSync(
    path.join(__dirname, '..', 'me', 'inventory', 'InventoryClient.tsx'),
    'utf8',
  );
  // The key must be on the outer div, not on ItemCard's fragment output
  // Look for: <div key={slot.key} ...> wrapping <ItemCard variant="slot" ...>
  assert.ok(
    inventoryClientSrc.includes('key={slot.key}'),
    'Expected key={slot.key} on the wrapping div in renderSlot — key must not be on the fragment'
  );
  // Also verify ItemCard itself is NOT given a key prop (the fragment can't receive one)
  const itemCardCallSite = inventoryClientSrc.slice(
    inventoryClientSrc.indexOf('<ItemCard'),
    inventoryClientSrc.indexOf('/>', inventoryClientSrc.indexOf('<ItemCard')) + 2,
  );
  assert.ok(
    !itemCardCallSite.includes('key='),
    'ItemCard slot usage should not have a key= prop — the parent div holds the key'
  );
});

// ---------------------------------------------------------------------------
// 12. me/page.tsx — null guards for hp / maxHp
// ---------------------------------------------------------------------------
console.log('\n--- me/page.tsx HP null guard check ---');

const mePageSrc = readFileSync(
  path.join(__dirname, '..', 'me', 'page.tsx'),
  'utf8',
);

test('me/page.tsx has null guard for inventory.hp (uses ?? 0)', () => {
  assert.ok(
    mePageSrc.includes('inventory.hp ?? 0'),
    'Expected `inventory.hp ?? 0` null guard in me/page.tsx'
  );
});

test('me/page.tsx has guard for maxHp = 0 (maxHp > 0 check)', () => {
  assert.ok(
    mePageSrc.includes('maxHp > 0'),
    'Expected `maxHp > 0` division-by-zero guard in me/page.tsx'
  );
});

test('me/page.tsx uses Math.min and Math.max for hp clamping', () => {
  assert.ok(
    mePageSrc.includes('Math.min(100,') && mePageSrc.includes('Math.max(0,'),
    'Expected Math.min(100,...) and Math.max(0,...) HP clamping in me/page.tsx'
  );
});

// ---------------------------------------------------------------------------
// 13. ShopClient tab state — router.refresh() does NOT reset tab state
// ---------------------------------------------------------------------------
console.log('\n--- ShopClient tab state reset check ---');

test('ShopClient tab state is declared with useState, not derived from props', () => {
  // If tab were derived from a server prop, router.refresh() would reset it.
  // useState('buy') persists across re-renders as long as the component stays mounted.
  assert.ok(
    shopClientSrc.includes("useState<'buy' | 'sell'>('buy')"),
    "Expected useState<'buy' | 'sell'>('buy') in ShopClient — tab state must be local"
  );
});

test('ShopClient router.refresh() does not reset tab (no tab prop passed from server)', () => {
  // Check that there is no `tab` prop in ShopClientProps type — tab is local state only.
  const propsSection = shopClientSrc.slice(
    shopClientSrc.indexOf('type ShopClientProps'),
    shopClientSrc.indexOf('};', shopClientSrc.indexOf('type ShopClientProps')) + 2,
  );
  assert.ok(
    !propsSection.includes('tab:'),
    'ShopClientProps must not include a "tab" field — that would allow server refresh to reset it'
  );
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailed tests:');
  for (const f of failures) {
    console.log(`  - ${f.name}`);
    console.log(`    ${f.message}`);
  }
}
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
