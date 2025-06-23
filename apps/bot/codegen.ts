import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  // documents: 'src/**/*.graphql',
  // schema: '../**/schema.gql',
  ignoreNoDocuments: true,
  generates: {
    'src/generated/dm-graphql.ts': {
      schema: '../dm/src/schema.gql',
      documents: 'src/graphql/dm.graphql',
      plugins: [
        { add: { content: "import type { RequestInit } from 'node-fetch';" } },
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
    },
    'src/generated/world-graphql.ts': {
      schema: '../world/src/schema.gql',
      documents: 'src/graphql/world.graphql',
      plugins: [
        { add: { content: "import type { RequestInit } from 'node-fetch';" } },
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
    },
  },
};
export default config;
