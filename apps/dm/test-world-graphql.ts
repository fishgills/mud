import { WorldService } from './src/app/world/world.service';

async function testWorldServiceGraphQL() {
  console.log('Testing DM -> World GraphQL communication...');

  const worldService = new WorldService();

  try {
    // Test health check
    console.log('1. Testing health check...');
    const isHealthy = await worldService.healthCheck();
    console.log('Health check result:', isHealthy);

    // Test getting tile info
    console.log('2. Testing getTileInfo...');
    const tileInfo = await worldService.getTileInfo(0, 0);
    console.log('Tile info:', JSON.stringify(tileInfo, null, 2));

    // Test enhanced tile info with nearby data
    console.log('3. Testing getTileInfoWithNearby...');
    const enhancedTileInfo = await worldService.getTileInfoWithNearby(0, 0);
    console.log(
      'Enhanced tile info:',
      JSON.stringify(enhancedTileInfo, null, 2),
    );

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWorldServiceGraphQL();
