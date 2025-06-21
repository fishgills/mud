#!/usr/bin/env ts-node

import { GraphQLClient, gql } from 'graphql-request';

async function testWorldConnection() {
  const worldServiceUrl =
    process.env.WORLD_SERVICE_URL || 'http://localhost:3000';
  const graphqlClient = new GraphQLClient(`${worldServiceUrl}/graphql`);

  console.log(`Testing connection to: ${worldServiceUrl}/graphql`);

  try {
    // Test 1: Health check query
    console.log('\n=== Test 1: Health Check ===');
    const healthQuery = gql`
      query HealthCheck {
        __schema {
          queryType {
            name
          }
        }
      }
    `;

    const healthResult = await graphqlClient.request(healthQuery);
    console.log('Health check result:', JSON.stringify(healthResult, null, 2));

    // Test 2: Get tile query (the one that's failing)
    console.log('\n=== Test 2: Get Tile Query ===');
    const getTileQuery = gql`
      query GetTile($x: Int!, $y: Int!) {
        getTile(x: $x, y: $y) {
          id
          x
          y
          biomeId
          biomeName
          description
          height
          temperature
          moisture
          seed
          chunkX
          chunkY
          createdAt
          updatedAt
        }
      }
    `;

    const tileResult = await graphqlClient.request(getTileQuery, {
      x: -501,
      y: 297,
    });
    console.log('Tile query result:', JSON.stringify(tileResult, null, 2));

    // Test 3: Get tile with nearby data (the enhanced query)
    console.log('\n=== Test 3: Get Tile With Nearby Data ===');
    const getTileWithNearbyQuery = gql`
      query GetTileWithNearby($x: Int!, $y: Int!) {
        getTile(x: $x, y: $y) {
          id
          x
          y
          biomeId
          biomeName
          description
          height
          temperature
          moisture
          seed
          chunkX
          chunkY
          createdAt
          updatedAt
          nearbyBiomes {
            biomeName
            distance
            direction
          }
          nearbySettlements {
            name
            type
            size
            population
            x
            y
            description
            distance
          }
          currentSettlement {
            name
            type
            size
            intensity
            isCenter
          }
        }
      }
    `;

    const enhancedTileResult = await graphqlClient.request(
      getTileWithNearbyQuery,
      { x: -501, y: 297 },
    );
    console.log(
      'Enhanced tile query result:',
      JSON.stringify(enhancedTileResult, null, 2),
    );

    console.log('\n✅ All tests passed! DM can connect to World service.');
  } catch (error) {
    console.error('\n❌ Connection test failed:');
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
  }
}

testWorldConnection().catch(console.error);
