import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  // documents: 'src/**/*.graphql',
  // schema: '../**/schema.gql',
  ignoreNoDocuments: true,
  generates: {
    'src/generated/dm-graphql.ts': {
      schema: '../../dm-schema.gql',
      documents: 'src/graphql/dm.graphql',
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
        // 'typescript-generic-sdk',
      ],
    },
    'src/generated/world-graphql.ts': {
      schema: '../../world-schema.gql',
      documents: 'src/graphql/world.graphql',
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
        // 'typescript-generic-sdk',
      ],
    },
  },
};
export default config;
