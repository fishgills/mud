#!/usr/bin/env node

/**
 * Test script for the new noise-based world generation system
 * This script demonstrates the deterministic, chunk-based world generation
 */

import { ChunkWorldGenerator } from './src/logic/chunk-generator';
import { NoiseGenerator } from './src/logic/noise-generator';
import { BiomeMapper } from './src/logic/biome-mapper';
import { DEFAULT_WORLD_CONFIG, MOUNTAINOUS_WORLD_CONFIG, ISLAND_WORLD_CONFIG } from './src/logic/world-config';

// Test different world configurations
const configs = {
  'Default': DEFAULT_WORLD_CONFIG,
  'Mountainous': MOUNTAINOUS_WORLD_CONFIG,
  'Island': ISLAND_WORLD_CONFIG
};

async function testWorldGeneration() {
  console.log('🌍 Testing Noise-Based World Generation System\n');

  for (const [configName, config] of Object.entries(configs)) {
    console.log(`📋 Testing ${configName} World Configuration:`);
    console.log(`   Chunk Size: ${config.chunkSize}x${config.chunkSize}`);
    console.log(`   Settlement Spacing: ${config.settlementSpacing}`);
    console.log(`   City Probability: ${config.cityProbability * 100}%`);
    console.log(`   Village Probability: ${config.villageProbability * 100}%\n`);

    const generator = new ChunkWorldGenerator(config.worldParameters, config.settlementSpacing);
    
    // Test individual tile generation
    console.log('🎯 Testing individual tile generation:');
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(Math.random() * 100) - 50;
      const y = Math.floor(Math.random() * 100) - 50;
      const tile = await generator.generateTile(x, y);
      console.log(`   (${x}, ${y}): ${tile.biomeId} - ${tile.description}`);
    }
    console.log();

    // Test chunk generation
    console.log('📦 Testing chunk generation:');
    const chunk = await generator.generateChunk(0, 0);
    const biomeCounts: Record<string, number> = {};
    
    for (const tile of chunk.tiles) {
      // Count biomes (we don't have biome names in this test, so use biomeId)
      const biomeKey = `biome_${tile.biomeId}`;
      biomeCounts[biomeKey] = (biomeCounts[biomeKey] || 0) + 1;
    }
    
    console.log(`   Generated chunk (0,0) with ${chunk.tiles.length} tiles`);
    console.log('   Biome distribution:');
    for (const [biome, count] of Object.entries(biomeCounts)) {
      const percentage = ((count / chunk.tiles.length) * 100).toFixed(1);
      console.log(`     ${biome}: ${count} tiles (${percentage}%)`);
    }
    console.log();

    // Test deterministic generation
    console.log('🔄 Testing deterministic generation:');
    const tile1 = await generator.generateTile(10, 20);
    const tile2 = await generator.generateTile(10, 20);
    const isDeterministic = tile1.biomeId === tile2.biomeId && 
                            tile1.description === tile2.description;
    console.log(`   Same coordinates produce same result: ${isDeterministic ? '✅' : '❌'}`);
    console.log();
  }

  // Test noise generation directly
  console.log('🎵 Testing noise generation directly:');
  const noiseGen = new NoiseGenerator(DEFAULT_WORLD_CONFIG.worldParameters);
  
  console.log('   Sample terrain data:');
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(Math.random() * 100);
    const y = Math.floor(Math.random() * 100);
    const terrain = noiseGen.generateTerrain(x, y);
    const biome = BiomeMapper.getBiome(terrain);
    
    console.log(`   (${x}, ${y}): h=${terrain.height.toFixed(2)} t=${terrain.temperature.toFixed(2)} m=${terrain.moisture.toFixed(2)} → ${biome}`);
  }
  console.log();

  // Test biome mapping
  console.log('🗺️  Testing biome mapping:');
  const testCases = [
    { height: 0.1, temperature: 0.5, moisture: 0.8, expected: 'ocean/lake' },
    { height: 0.9, temperature: 0.2, moisture: 0.3, expected: 'mountains' },
    { height: 0.5, temperature: 0.8, moisture: 0.9, expected: 'jungle/rainforest' },
    { height: 0.4, temperature: 0.9, moisture: 0.1, expected: 'desert' },
    { height: 0.6, temperature: 0.1, moisture: 0.2, expected: 'tundra' }
  ];

  for (const testCase of testCases) {
    const biome = BiomeMapper.getBiome(testCase);
    console.log(`   h=${testCase.height} t=${testCase.temperature} m=${testCase.moisture} → ${biome} (expected: ${testCase.expected})`);
  }

  console.log('\n🎉 World generation testing complete!');
}

// Only run if this file is executed directly
if (require.main === module) {
  testWorldGeneration().catch(console.error);
}

export { testWorldGeneration };
