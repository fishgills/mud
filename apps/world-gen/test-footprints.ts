import { SettlementGenerator, SettlementInfo } from './src/utils/settlement';

// Test the settlement footprint system
const seed = 12345;
const settlementGenerator = new SettlementGenerator(seed);

// Create test settlements with different sizes
const settlements: SettlementInfo[] = [
  {
    name: 'Trade Haven',
    type: 'city',
    size: 'large',
    population: 12000,
    x: 10,
    y: 10,
    description: 'A grand city that serves as a major trading hub',
    footprint: settlementGenerator.generateSettlementFootprint(
      10,
      10,
      'large',
      () => Math.random()
    ),
  },
  {
    name: 'Riverside',
    type: 'town',
    size: 'medium',
    population: 2500,
    x: 25,
    y: 25,
    description: 'A prosperous town built along a flowing river',
    footprint: settlementGenerator.generateSettlementFootprint(
      25,
      25,
      'medium',
      () => Math.random()
    ),
  },
  {
    name: 'Greenfield',
    type: 'village',
    size: 'small',
    population: 150,
    x: 35,
    y: 30,
    description: 'A small farming village nestled in fertile plains',
    footprint: settlementGenerator.generateSettlementFootprint(
      35,
      30,
      'small',
      () => Math.random()
    ),
  },
];

console.log('Generated settlements with footprints:');
settlements.forEach((settlement) => {
  console.log(`\n${settlement.name} (${settlement.type}, ${settlement.size}):`);
  console.log(`  Population: ${settlement.population}`);
  console.log(`  Center: (${settlement.x}, ${settlement.y})`);
  console.log(`  Footprint tiles: ${settlement.footprint?.tiles.length || 0}`);
  console.log(`  Footprint radius: ${settlement.footprint?.radius || 0}`);
});

// Create a simple ASCII map showing the settlement footprints
const minX = 0,
  maxX = 50,
  minY = 0,
  maxY = 40;

console.log(
  `\nSettlement Footprint Map (${minX},${minY}) to (${maxX - 1},${maxY - 1}):`
);
console.log(
  'Legend: ★ Settlement center, ▓ Dense area, ▒ Medium area, ░ Light area, . Empty'
);

for (let y = minY; y < maxY; y++) {
  let row = '';
  for (let x = minX; x < maxX; x++) {
    let symbol = '.'; // Empty by default

    // Check each settlement for footprint coverage
    for (const settlement of settlements) {
      // Check if this is the settlement center
      if (settlement.x === x && settlement.y === y) {
        symbol = '★';
        break;
      }

      // Check if this coordinate is in the settlement footprint
      if (settlement.footprint) {
        const tile = settlement.footprint.tiles.find(
          (t) => t.x === x && t.y === y
        );
        if (tile) {
          if (tile.intensity >= 0.8) {
            symbol = '▓'; // Dense
          } else if (tile.intensity >= 0.5) {
            symbol = '▒'; // Medium
          } else if (tile.intensity >= 0.2) {
            symbol = '░'; // Light
          }
          break;
        }
      }
    }

    row += symbol;
  }
  console.log(row);
}

console.log('\nSettlement footprint generation complete!');
