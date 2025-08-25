import type { RequestInit } from 'node-fetch';
import { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: any; output: any; }
};

export type Biome = {
  __typename?: 'Biome';
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  tiles?: Maybe<Array<WorldTile>>;
};

export type BiomeCount = {
  __typename?: 'BiomeCount';
  biomeName: Scalars['String']['output'];
  count: Scalars['Int']['output'];
};

export type ChunkData = {
  __typename?: 'ChunkData';
  biomeStats?: Maybe<Array<BiomeCount>>;
  chunkX: Scalars['Int']['output'];
  chunkY: Scalars['Int']['output'];
  paginatedTiles?: Maybe<PaginatedTiles>;
  settlements?: Maybe<Array<Settlement>>;
  stats?: Maybe<ChunkStats>;
  tiles?: Maybe<Array<WorldTile>>;
};


export type ChunkDataPaginatedTilesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type ChunkStats = {
  __typename?: 'ChunkStats';
  averageHeight: Scalars['Float']['output'];
  averageMoisture: Scalars['Float']['output'];
  averageTemperature: Scalars['Float']['output'];
};

export type CurrentSettlement = {
  __typename?: 'CurrentSettlement';
  intensity: Scalars['Float']['output'];
  isCenter: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  size: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type MapTile = {
  __typename?: 'MapTile';
  biomeName?: Maybe<Scalars['String']['output']>;
  hasSettlement: Scalars['Boolean']['output'];
  isSettlementCenter: Scalars['Boolean']['output'];
  symbol?: Maybe<Scalars['String']['output']>;
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Clears the render cache in Redis. Returns number of keys removed. */
  clearRenderCache: Scalars['Int']['output'];
  /** DEBUG: Deletes all world tiles from the database. Use with caution. */
  deleteAllWorldTiles: TileUpdateResult;
  updateTileDescription: TileUpdateResult;
};


export type MutationClearRenderCacheArgs = {
  pattern?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateTileDescriptionArgs = {
  description: Scalars['String']['input'];
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
};

export type NearbyBiome = {
  __typename?: 'NearbyBiome';
  biomeName: Scalars['String']['output'];
  direction: Scalars['String']['output'];
  distance: Scalars['Float']['output'];
};

export type NearbySettlement = {
  __typename?: 'NearbySettlement';
  description: Scalars['String']['output'];
  distance: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  population: Scalars['Int']['output'];
  size: Scalars['String']['output'];
  type: Scalars['String']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type PaginatedTiles = {
  __typename?: 'PaginatedTiles';
  hasMore: Scalars['Boolean']['output'];
  limit: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
  tiles: Array<WorldTile>;
  totalCount: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  getChunk: ChunkData;
  getTile: TileWithNearbyBiomes;
  /** Returns an ASCII map centered on (x, y) with a 50x50 region. */
  renderMapAscii: Scalars['String']['output'];
  /** Returns a PNG map centered on (x, y) as a base64 string (50x50 region). */
  renderMapPngBase64: Scalars['String']['output'];
  /** Returns a 2D array of map tiles for a 50x50 region centered on (x, y). */
  renderMapTiles: Array<Array<MapTile>>;
};


export type QueryGetChunkArgs = {
  chunkX: Scalars['Float']['input'];
  chunkY: Scalars['Float']['input'];
};


export type QueryGetTileArgs = {
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
};


export type QueryRenderMapAsciiArgs = {
  x?: InputMaybe<Scalars['Int']['input']>;
  y?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryRenderMapPngBase64Args = {
  pixelsPerTile?: InputMaybe<Scalars['Int']['input']>;
  x?: InputMaybe<Scalars['Int']['input']>;
  y?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryRenderMapTilesArgs = {
  x?: InputMaybe<Scalars['Int']['input']>;
  y?: InputMaybe<Scalars['Int']['input']>;
};

export type Settlement = {
  __typename?: 'Settlement';
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  population: Scalars['Int']['output'];
  size: Scalars['String']['output'];
  type: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type TileUpdateResult = {
  __typename?: 'TileUpdateResult';
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type TileWithNearbyBiomes = {
  __typename?: 'TileWithNearbyBiomes';
  biome?: Maybe<Biome>;
  biomeId: Scalars['Int']['output'];
  biomeName: Scalars['String']['output'];
  chunkX: Scalars['Int']['output'];
  chunkY: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  currentSettlement?: Maybe<CurrentSettlement>;
  description?: Maybe<Scalars['String']['output']>;
  height: Scalars['Float']['output'];
  id: Scalars['Int']['output'];
  moisture: Scalars['Float']['output'];
  nearbyBiomes: Array<NearbyBiome>;
  nearbySettlements: Array<NearbySettlement>;
  seed: Scalars['Int']['output'];
  temperature: Scalars['Float']['output'];
  updatedAt: Scalars['DateTime']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type WorldTile = {
  __typename?: 'WorldTile';
  biome?: Maybe<Biome>;
  biomeId: Scalars['Int']['output'];
  biomeName: Scalars['String']['output'];
  chunkX: Scalars['Int']['output'];
  chunkY: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  height: Scalars['Float']['output'];
  id: Scalars['Int']['output'];
  moisture: Scalars['Float']['output'];
  seed: Scalars['Int']['output'];
  temperature: Scalars['Float']['output'];
  updatedAt: Scalars['DateTime']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type GetTileQueryVariables = Exact<{
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
}>;


export type GetTileQuery = { __typename?: 'Query', getTile: { __typename?: 'TileWithNearbyBiomes', id: number, x: number, y: number, biomeId: number, biomeName: string, description?: string | null, height: number, temperature: number, moisture: number, seed: number, chunkX: number, chunkY: number, createdAt: any, updatedAt: any } };


export const GetTileDocument = gql`
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

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    GetTile(variables: GetTileQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetTileQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetTileQuery>({ document: GetTileDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetTile', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;