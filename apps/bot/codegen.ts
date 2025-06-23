// schema:
// documents: src/**/*.graphql
// generates:
//   src/generated/dm-graphql.ts:
//     schema: ../dm/src/schema.gql
//     config:
//       exposeFetcher: true
//       interfacePrefix: DMI
//       typesPrefix: DMT
//     documents:
//       - src/**/*.ts
//     plugins:
//       - typescript
//       - typescript-operations
//       - typescript-graphql-request
//       # - typescript-generic-sdk
//   # src/generated/world-graphql.ts:
//   #   schema: ../world/src/schema.gql
//   #   documents:
//   #     - src/**/*.ts
//   #   plugins:
//   #     - typescript
//   #     - typescript-operations
//   #     - typescript-graphql-request
import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  documents: 'src/**/*.graphql',
  schema: '../**/schema.gql',
  ignoreNoDocuments: true,
  generates: {
    'src/generated/dm-graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
      config: {
        exposeFetcher: true,
        skipTypename: true,
        declarationKind: 'interface',
        noNamespace: true,
        withHooks: true,
        interfacePrefix: 'DMI',
        typesPrefix: 'DMT',
        fetcher: 'graphql-request',
      },
    },
  },
};
export default config;
