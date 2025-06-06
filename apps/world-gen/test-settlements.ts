#!/usr/bin/env node

import { SettlementGenerator } from './src/utils/settlement';
import { BIOMES } from './src/utils/biome';

// Test the new settlement footprint system
function testSettlementFootprints() {
  console.log('Testing Settlement Footprints with Irregular Shapes\n');

  const seed = 12345;
  const generator = new SettlementGenerator(seed);

  // Create different sized settlements
  const settlements = [
    { x: 50, y: 50, size: 'large' as const, name: 'Test City' },
    { x: 70, y: 30, size: 'medium' as const, name: 'Test Town' },
    { x: 30, y: 70, size: 'small' as const, name: 'Test Village' },
    { x: 90, y: 90, size: 'tiny' as const, name: 'Test Hamlet' },
  ];

  // Generate settlements with footprints
  const generatedSettlements = settlements.map((s) => {
    return generator.generateSettlement(s.x, s.y, BIOMES.GRASSLAND);
  });

  // Create a simple ASCII map showing settlement footprints
  const minX = 20,
    maxX = 100,
    minY = 20,
    maxY = 100;

  console.log(
    `Settlement Footprint Map (${minX},${minY}) to (${maxX},${maxY})`
  );
  console.log(
    'Legend: ★ = Settlement Center, ▓ = Dense, ▒ = Medium, ░ = Sparse, . = Empty\n'
  );

  for (let y = minY; y < maxY; y++) {
    let row = '';
    for (let x = minX; x < maxX; x++) {
      const settlementInfo = SettlementGenerator.getSettlementAtCoordinate(
        x,
        y,
        generatedSettlements
      );

      if (settlementInfo.isSettlement) {
        // Check if this is the settlement center
        const isCenter = generatedSettlements.some(
          (s) => s.x === x && s.y === y
        );
        if (isCenter) {
          row += '★';
        } else {
          const intensity = settlementInfo.intensity;
          if (intensity > 0.7) {
            row += '▓';
          } else if (intensity > 0.4) {
            row += '▒';
          } else {
            row += '░';
          }
        }
      } else {
        row += '.';
      }
    }
    console.log(row);
  }

  // Print settlement details
  console.log('\nSettlement Details:');
  generatedSettlements.forEach((settlement) => {
    console.log(
      `${settlement.name} (${settlement.type}): Center at (${settlement.x}, ${settlement.y})`
    );
    console.log(
      `  Size: ${settlement.size}, Population: ${settlement.population}`
    );
    if (settlement.footprint) {
      console.log(
        `  Footprint: ${settlement.footprint.tiles.length} tiles, radius: ${settlement.footprint.radius}`
      );
    }
    console.log();
  });
}

testSettlementFootprints();
