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

/**
 * A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.
 *
 * In some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.
 */
export type __Directive = {
  __typename?: '__Directive';
  name: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  isRepeatable: Scalars['Boolean']['output'];
  locations: Array<__DirectiveLocation>;
  args: Array<__InputValue>;
};


/**
 * A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.
 *
 * In some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.
 */
export type __DirectiveArgsArgs = {
  includeDeprecated?: InputMaybe<Scalars['Boolean']['input']>;
};

/** A Directive can be adjacent to many parts of the GraphQL language, a __DirectiveLocation describes one such possible adjacencies. */
export enum __DirectiveLocation {
  /** Location adjacent to a query operation. */
  Query = 'QUERY',
  /** Location adjacent to a mutation operation. */
  Mutation = 'MUTATION',
  /** Location adjacent to a subscription operation. */
  Subscription = 'SUBSCRIPTION',
  /** Location adjacent to a field. */
  Field = 'FIELD',
  /** Location adjacent to a fragment definition. */
  FragmentDefinition = 'FRAGMENT_DEFINITION',
  /** Location adjacent to a fragment spread. */
  FragmentSpread = 'FRAGMENT_SPREAD',
  /** Location adjacent to an inline fragment. */
  InlineFragment = 'INLINE_FRAGMENT',
  /** Location adjacent to a variable definition. */
  VariableDefinition = 'VARIABLE_DEFINITION',
  /** Location adjacent to a schema definition. */
  Schema = 'SCHEMA',
  /** Location adjacent to a scalar definition. */
  Scalar = 'SCALAR',
  /** Location adjacent to an object type definition. */
  Object = 'OBJECT',
  /** Location adjacent to a field definition. */
  FieldDefinition = 'FIELD_DEFINITION',
  /** Location adjacent to an argument definition. */
  ArgumentDefinition = 'ARGUMENT_DEFINITION',
  /** Location adjacent to an interface definition. */
  Interface = 'INTERFACE',
  /** Location adjacent to a union definition. */
  Union = 'UNION',
  /** Location adjacent to an enum definition. */
  Enum = 'ENUM',
  /** Location adjacent to an enum value definition. */
  EnumValue = 'ENUM_VALUE',
  /** Location adjacent to an input object type definition. */
  InputObject = 'INPUT_OBJECT',
  /** Location adjacent to an input object field definition. */
  InputFieldDefinition = 'INPUT_FIELD_DEFINITION'
}

/** One possible value for a given Enum. Enum values are unique values, not a placeholder for a string or numeric value. However an Enum value is returned in a JSON response as a string. */
export type __EnumValue = {
  __typename?: '__EnumValue';
  name: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  isDeprecated: Scalars['Boolean']['output'];
  deprecationReason?: Maybe<Scalars['String']['output']>;
};

/** Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type. */
export type __Field = {
  __typename?: '__Field';
  name: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  args: Array<__InputValue>;
  type: __Type;
  isDeprecated: Scalars['Boolean']['output'];
  deprecationReason?: Maybe<Scalars['String']['output']>;
};


/** Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type. */
export type __FieldArgsArgs = {
  includeDeprecated?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Arguments provided to Fields or Directives and the input fields of an InputObject are represented as Input Values which describe their type and optionally a default value. */
export type __InputValue = {
  __typename?: '__InputValue';
  name: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  type: __Type;
  /** A GraphQL-formatted string representing the default value for this input value. */
  defaultValue?: Maybe<Scalars['String']['output']>;
  isDeprecated: Scalars['Boolean']['output'];
  deprecationReason?: Maybe<Scalars['String']['output']>;
};

/** A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations. */
export type __Schema = {
  __typename?: '__Schema';
  description?: Maybe<Scalars['String']['output']>;
  /** A list of all types supported by this server. */
  types: Array<__Type>;
  /** The type that query operations will be rooted at. */
  queryType: __Type;
  /** If this server supports mutation, the type that mutation operations will be rooted at. */
  mutationType?: Maybe<__Type>;
  /** If this server support subscription, the type that subscription operations will be rooted at. */
  subscriptionType?: Maybe<__Type>;
  /** A list of all directives supported by this server. */
  directives: Array<__Directive>;
};

/**
 * The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.
 *
 * Depending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name, description and optional `specifiedByURL`, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.
 */
export type __Type = {
  __typename?: '__Type';
  kind: __TypeKind;
  name?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  specifiedByURL?: Maybe<Scalars['String']['output']>;
  fields?: Maybe<Array<__Field>>;
  interfaces?: Maybe<Array<__Type>>;
  possibleTypes?: Maybe<Array<__Type>>;
  enumValues?: Maybe<Array<__EnumValue>>;
  inputFields?: Maybe<Array<__InputValue>>;
  ofType?: Maybe<__Type>;
  isOneOf?: Maybe<Scalars['Boolean']['output']>;
};


/**
 * The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.
 *
 * Depending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name, description and optional `specifiedByURL`, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.
 */
export type __TypeFieldsArgs = {
  includeDeprecated?: InputMaybe<Scalars['Boolean']['input']>;
};


/**
 * The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.
 *
 * Depending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name, description and optional `specifiedByURL`, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.
 */
export type __TypeEnumValuesArgs = {
  includeDeprecated?: InputMaybe<Scalars['Boolean']['input']>;
};


/**
 * The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.
 *
 * Depending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name, description and optional `specifiedByURL`, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.
 */
export type __TypeInputFieldsArgs = {
  includeDeprecated?: InputMaybe<Scalars['Boolean']['input']>;
};

/** An enum describing what kind of type a given `__Type` is. */
export enum __TypeKind {
  /** Indicates this type is a scalar. */
  Scalar = 'SCALAR',
  /** Indicates this type is an object. `fields` and `interfaces` are valid fields. */
  Object = 'OBJECT',
  /** Indicates this type is an interface. `fields`, `interfaces`, and `possibleTypes` are valid fields. */
  Interface = 'INTERFACE',
  /** Indicates this type is a union. `possibleTypes` is a valid field. */
  Union = 'UNION',
  /** Indicates this type is an enum. `enumValues` is a valid field. */
  Enum = 'ENUM',
  /** Indicates this type is an input object. `inputFields` is a valid field. */
  InputObject = 'INPUT_OBJECT',
  /** Indicates this type is a list. `ofType` is a valid field. */
  List = 'LIST',
  /** Indicates this type is a non-null. `ofType` is a valid field. */
  NonNull = 'NON_NULL'
}

export type GetTileQueryVariables = Exact<{
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
}>;


export type GetTileQuery = { __typename?: 'Query', getTile: { __typename?: 'TileWithNearbyBiomes', id: number, x: number, y: number, biomeId: number, biomeName: string, description?: string | null, height: number, temperature: number, moisture: number, seed: number, chunkX: number, chunkY: number, createdAt: any, updatedAt: any } };

export type GetChunkQueryVariables = Exact<{
  chunkX: Scalars['Float']['input'];
  chunkY: Scalars['Float']['input'];
}>;


export type GetChunkQuery = { __typename?: 'Query', getChunk: { __typename?: 'ChunkData', chunkX: number, chunkY: number, tiles?: Array<{ __typename?: 'WorldTile', id: number, x: number, y: number, biomeId: number, biomeName: string, description?: string | null, height: number, temperature: number, moisture: number, seed: number, chunkX: number, chunkY: number, createdAt: any, updatedAt: any }> | null } };

export type UpdateTileDescriptionMutationVariables = Exact<{
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
  description: Scalars['String']['input'];
}>;


export type UpdateTileDescriptionMutation = { __typename?: 'Mutation', updateTileDescription: { __typename?: 'TileUpdateResult', success: boolean, message: string } };

export type HealthCheckQueryVariables = Exact<{ [key: string]: never; }>;


export type HealthCheckQuery = { __typename?: 'Query', __schema: { __typename?: '__Schema', queryType: { __typename?: '__Type', name?: string | null } } };

export type GetTileWithNearbyQueryVariables = Exact<{
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
}>;


export type GetTileWithNearbyQuery = { __typename?: 'Query', getTile: { __typename?: 'TileWithNearbyBiomes', id: number, x: number, y: number, biomeId: number, biomeName: string, description?: string | null, height: number, temperature: number, moisture: number, seed: number, chunkX: number, chunkY: number, createdAt: any, updatedAt: any, nearbyBiomes: Array<{ __typename?: 'NearbyBiome', biomeName: string, distance: number, direction: string }>, nearbySettlements: Array<{ __typename?: 'NearbySettlement', name: string, type: string, size: string, population: number, x: number, y: number, description: string, distance: number }>, currentSettlement?: { __typename?: 'CurrentSettlement', name: string, type: string, size: string, intensity: number, isCenter: boolean } | null } };


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
export const GetChunkDocument = gql`
    query GetChunk($chunkX: Float!, $chunkY: Float!) {
  getChunk(chunkX: $chunkX, chunkY: $chunkY) {
    chunkX
    chunkY
    tiles {
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
}
    `;
export const UpdateTileDescriptionDocument = gql`
    mutation UpdateTileDescription($x: Int!, $y: Int!, $description: String!) {
  updateTileDescription(x: $x, y: $y, description: $description) {
    success
    message
  }
}
    `;
export const HealthCheckDocument = gql`
    query HealthCheck {
  __schema {
    queryType {
      name
    }
  }
}
    `;
export const GetTileWithNearbyDocument = gql`
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

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    GetTile(variables: GetTileQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetTileQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetTileQuery>({ document: GetTileDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetTile', 'query', variables);
    },
    GetChunk(variables: GetChunkQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetChunkQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetChunkQuery>({ document: GetChunkDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetChunk', 'query', variables);
    },
    UpdateTileDescription(variables: UpdateTileDescriptionMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateTileDescriptionMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateTileDescriptionMutation>({ document: UpdateTileDescriptionDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateTileDescription', 'mutation', variables);
    },
    HealthCheck(variables?: HealthCheckQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<HealthCheckQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<HealthCheckQuery>({ document: HealthCheckDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'HealthCheck', 'query', variables);
    },
    GetTileWithNearby(variables: GetTileWithNearbyQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetTileWithNearbyQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetTileWithNearbyQuery>({ document: GetTileWithNearbyDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetTileWithNearby', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;