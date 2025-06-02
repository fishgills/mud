import { getPrismaClient } from '@mud/database';
import type { PrismaClient } from '@mud/database';

const prisma: PrismaClient = getPrismaClient();
export default prisma;
