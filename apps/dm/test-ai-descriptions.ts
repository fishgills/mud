import { GraphQLClient, gql } from 'graphql-request';

const dmClient = new GraphQLClient('http://localhost:3001/graphql');

async function testAIDescriptions() {
  console.log('Testing AI-generated tile descriptions...\n');

  try {
    // First, let's see if we have any players
    const GET_PLAYERS_QUERY = gql`
      query GetPlayers {
        getAllPlayers {
          id
          slackId
          name
          x
          y
        }
      }
    `;

    console.log('1. Getting current players...');
    const playersResult = (await dmClient.request(GET_PLAYERS_QUERY)) as any;
    console.log('Players:', JSON.stringify(playersResult, null, 2));

    const players = playersResult.getAllPlayers || [];
    let testPlayer = players.find((p: any) => p.slackId === 'test-user-001');

    // Create a test player if none exists
    if (!testPlayer) {
      console.log('\n2. Creating test player...');
      const CREATE_PLAYER_MUTATION = gql`
        mutation CreatePlayer($input: CreatePlayerInput!) {
          createPlayer(input: $input) {
            success
            message
            data {
              id
              slackId
              name
              x
              y
            }
          }
        }
      `;

      const createResult = (await dmClient.request(CREATE_PLAYER_MUTATION, {
        input: {
          slackId: 'test-user-001',
          name: 'Test User',
          x: 0,
          y: 0,
        },
      })) as any;
      console.log(
        'Create player result:',
        JSON.stringify(createResult, null, 2),
      );

      if (createResult.createPlayer?.data) {
        testPlayer = createResult.createPlayer.data;
      } else {
        throw new Error('Failed to create test player');
      }
    }

    console.log('\n3. Moving player to trigger AI description generation...');

    // Move the player to different directions to trigger AI description generation
    const MOVE_PLAYER_MUTATION = gql`
      mutation MovePlayer($slackId: String!, $input: MovePlayerInput!) {
        movePlayer(slackId: $slackId, input: $input) {
          success
          message
          data {
            player {
              id
              slackId
              name
              x
              y
            }
            location {
              x
              y
              biomeName
              description
              height
              temperature
              moisture
            }
            surroundingTiles {
              x
              y
              biomeName
              description
              direction
            }
            playerInfo
            description
            nearbyBiomes
            nearbySettlements
            currentSettlement
          }
        }
      }
    `;

    // Test moving in different directions to see AI generation
    const testMoves = [
      { direction: 'NORTH', description: 'Move North' },
      { direction: 'EAST', description: 'Move East' },
      { direction: 'SOUTH', description: 'Move South' },
      { direction: 'WEST', description: 'Move West' },
    ];

    for (const move of testMoves) {
      console.log(`\n${move.description}:`);

      const moveResult = (await dmClient.request(MOVE_PLAYER_MUTATION, {
        slackId: testPlayer.slackId,
        input: {
          direction: move.direction,
        },
      })) as any;

      if (moveResult.movePlayer?.success) {
        const data = moveResult.movePlayer.data;
        console.log(
          `✓ Move successful to (${data.player.x}, ${data.player.y})`,
        );
        console.log(`  Biome: ${data.location.biomeName}`);
        console.log(
          `  AI Location Description: "${data.location.description || 'No description'}"`,
        );
        console.log(
          `  AI Movement Description: "${data.description || 'No movement description'}"`,
        );
        console.log(`  Player Info: "${data.playerInfo || 'No player info'}"`);
        console.log(
          `  Current Settlement: "${data.currentSettlement || 'No settlement'}"`,
        );

        // Show nearby biomes and settlements
        if (data.nearbyBiomes && data.nearbyBiomes.length > 0) {
          console.log(`  Nearby Biomes: ${data.nearbyBiomes.join(', ')}`);
        }
        if (data.nearbySettlements && data.nearbySettlements.length > 0) {
          console.log(
            `  Nearby Settlements: ${data.nearbySettlements.join(', ')}`,
          );
        }

        // Show some surrounding tiles
        if (data.surroundingTiles && data.surroundingTiles.length > 0) {
          console.log('  Surrounding tiles (first 3):');
          data.surroundingTiles.slice(0, 3).forEach((tile: any) => {
            console.log(
              `    ${tile.direction} (${tile.x}, ${tile.y}): ${tile.biomeName} - "${tile.description || 'No description'}"`,
            );
          });
        }
      } else {
        console.log(`✗ Move failed: ${moveResult.movePlayer?.message}`);
      }

      // Wait a moment between moves
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log('\n✓ AI description test completed successfully!');
  } catch (error) {
    console.error('Error testing AI descriptions:', error);

    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testAIDescriptions().catch(console.error);
