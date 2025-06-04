import { mockDeep, mock, DeepMockProxy } from 'jest-mock-extended';
import { getPrismaClient, PrismaClient } from '@mud/database';
import Redis from 'ioredis-mock';

// Extend global jest types
declare global {
  const jest: typeof import('@jest/globals').jest;
}

// Create the Prisma mock instance
const prismaMock = mockDeep<PrismaClient>();

// Mock ioredis
jest.mock('ioredis', () => Redis);

// Mock Prisma module
jest.mock('./prisma', () => ({
  __esModule: true,
  default: prismaMock,
}));

// Export mocks for use in tests
export { prismaMock };
