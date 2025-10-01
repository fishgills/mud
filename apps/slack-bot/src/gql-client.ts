import { GraphQLClient } from 'graphql-request';
import { authorizedFetch } from '@mud/gcp-auth';
import { env } from './env';
import * as DM from './generated/dm-graphql';
import gql from 'graphql-tag';

// Ensure the provided endpoint URL targets the GraphQL path. This guards against
// misconfigurations like missing /graphql and preserves existing base path (e.g., /world -> /world/graphql).
function ensureGraphQLEndpoint(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    if (!/\/graphql\/?$/.test(u.pathname)) {
      const basePath = u.pathname.replace(/\/$/, '');
      u.pathname = `${basePath}/graphql`;
    }
    return u.toString();
  } catch {
    // If URL parsing fails, just return the original string
    return urlStr;
  }
}

const dmClient = new GraphQLClient(ensureGraphQLEndpoint(env.DM_GQL_ENDPOINT), {
  fetch: authorizedFetch,
});

// GraphQL Documents
const MovePlayerDocument = gql`
  mutation MovePlayer($slackId: String!, $input: MovePlayerInput!) {
    movePlayer(slackId: $slackId, input: $input) {
      success
      message
      monsters {
        name
        id
      }
      playersAtLocation {
        name
        level
      }
      player {
        x
        y
      }
    }
  }
`;

const AttackDocument = gql`
  mutation Attack($slackId: String!, $input: AttackInput!) {
    attack(slackId: $slackId, input: $input) {
      success
      message
      data {
        winnerName
        loserName
        totalDamageDealt
        roundsCompleted
        xpGained
        goldGained
        message
        playerMessages {
          slackId
          name
          message
        }
        success
      }
    }
  }
`;

const GetPlayerDocument = gql`
  query GetPlayer($slackId: String, $name: String) {
    getPlayer(slackId: $slackId, name: $name) {
      success
      message
      data {
        id
        name
        x
        y
        hp
        maxHp
        strength
        agility
        health
        gold
        xp
        level
        skillPoints
        isAlive
        nearbyMonsters {
          id
          name
          hp
          isAlive
        }
      }
    }
  }
`;

const GetLocationEntitiesDocument = gql`
  query GetLocationEntities($x: Float!, $y: Float!) {
    getPlayersAtLocation(x: $x, y: $y) {
      id
      slackId
      name
      x
      y
      hp
      maxHp
      strength
      agility
      health
      gold
      xp
      level
      skillPoints
      isAlive
    }
    getMonstersAtLocation(x: $x, y: $y) {
      id
      name
      type
      hp
      maxHp
      strength
      agility
      health
      x
      y
      isAlive
    }
  }
`;

const GetPlayerWithLocationDocument = gql`
  query GetPlayerWithLocation($slackId: String!) {
    getPlayer(slackId: $slackId) {
      success
      message
      data {
        id
        name
        x
        y
        hp
        maxHp
        strength
        agility
        health
        gold
        xp
        level
        skillPoints
        isAlive
        nearbyMonsters {
          id
          name
          hp
          isAlive
        }
        currentTile {
          x
          y
          biomeName
          description
          height
          temperature
          moisture
        }
        nearbyPlayers {
          id
          name
          hp
          isAlive
        }
      }
    }
  }
`;

const GetLookViewDocument = gql`
  query GetLookView($slackId: String!) {
    getLookView(slackId: $slackId) {
      success
      message
      data {
        location {
          x
          y
          biomeName
          description
          height
          temperature
          moisture
        }
        currentSettlement {
          name
          type
          size
          intensity
          isCenter
        }
        monsters {
          id
          name
        }
        visibilityRadius
        biomeSummary {
          biomeName
          proportion
          predominantDirections
        }
        visiblePeaks {
          x
          y
          height
          distance
          direction
        }
        visibleSettlements {
          name
          type
          size
          distance
          direction
        }
        nearbyPlayers {
          distance
          direction
          x
          y
        }
        description
      }
    }
  }
`;

const CreatePlayerDocument = gql`
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
        hp
        maxHp
        strength
        agility
        health
        gold
        xp
        level
        skillPoints
        isAlive
        updatedAt
      }
    }
  }
`;

const RerollPlayerStatsDocument = gql`
  mutation RerollPlayerStats($slackId: String!) {
    rerollPlayerStats(slackId: $slackId) {
      success
      message
      data {
        id
        slackId
        name
        strength
        agility
        health
        maxHp
      }
    }
  }
`;

const CompletePlayerDocument = gql`
  mutation CompletePlayer($slackId: String!) {
    updatePlayerStats(slackId: $slackId, input: { hp: 10 }) {
      success
      message
      data {
        id
        slackId
        name
        isAlive
      }
    }
  }
`;

const DeletePlayerDocument = gql`
  mutation DeletePlayer($slackId: String!) {
    deletePlayer(slackId: $slackId) {
      success
      message
      data {
        id
        slackId
        name
      }
    }
  }
`;

const IncreaseSkillDocument = gql`
  mutation IncreaseSkill($slackId: String!, $skill: String!) {
    increaseSkill(slackId: $slackId, skill: $skill) {
      success
      message
      data {
        id
        name
        strength
        agility
        health
        hp
        maxHp
        skillPoints
        xp
        level
        gold
        x
        y
        isAlive
      }
    }
  }
`;

// Create SDK wrapper for DM service
export const dmSdk = {
  MovePlayer: (variables: DM.MovePlayerMutationVariables) =>
    dmClient.request<DM.MovePlayerMutation>(MovePlayerDocument, variables),
  Attack: (variables: DM.AttackMutationVariables) =>
    dmClient.request<DM.AttackMutation>(AttackDocument, variables),
  GetPlayer: (variables?: DM.GetPlayerQueryVariables) =>
    dmClient.request<DM.GetPlayerQuery>(GetPlayerDocument, variables),
  GetLocationEntities: (variables: DM.GetLocationEntitiesQueryVariables) =>
    dmClient.request<DM.GetLocationEntitiesQuery>(
      GetLocationEntitiesDocument,
      variables,
    ),
  GetPlayerWithLocation: (variables: DM.GetPlayerWithLocationQueryVariables) =>
    dmClient.request<DM.GetPlayerWithLocationQuery>(
      GetPlayerWithLocationDocument,
      variables,
    ),
  GetLookView: (variables: DM.GetLookViewQueryVariables) =>
    dmClient.request<DM.GetLookViewQuery>(GetLookViewDocument, variables),
  CreatePlayer: (variables: DM.CreatePlayerMutationVariables) =>
    dmClient.request<DM.CreatePlayerMutation>(CreatePlayerDocument, variables),
  RerollPlayerStats: (variables: DM.RerollPlayerStatsMutationVariables) =>
    dmClient.request<DM.RerollPlayerStatsMutation>(
      RerollPlayerStatsDocument,
      variables,
    ),
  CompletePlayer: (variables: DM.CompletePlayerMutationVariables) =>
    dmClient.request<DM.CompletePlayerMutation>(
      CompletePlayerDocument,
      variables,
    ),
  DeletePlayer: (variables: DM.DeletePlayerMutationVariables) =>
    dmClient.request<DM.DeletePlayerMutation>(DeletePlayerDocument, variables),
  IncreaseSkill: (variables: DM.IncreaseSkillMutationVariables) =>
    dmClient.request<DM.IncreaseSkillMutation>(
      IncreaseSkillDocument,
      variables,
    ),
};

// Create SDK wrapper for World service - placeholder for now
export const worldSdk = {};
