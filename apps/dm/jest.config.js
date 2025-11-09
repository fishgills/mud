import baseConfig from '../../jest.base.config.cjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  ...baseConfig,
  displayName: '@mud/dm',
  moduleNameMapper: {
    ...(baseConfig.moduleNameMapper ?? {}),
    '^@mud/engine$': path.resolve(__dirname, '../../libs/engine/dist/index.js'),
    '^@mud/redis-client$': path.resolve(
      __dirname,
      '../../libs/redis-client/dist/redis-client.js',
    ),
  },
};
