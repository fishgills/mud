import { getPrismaClient } from '../lib/database.js';

export async function upsertWorkspaceInstall(
  workspaceId: string,
  installedAt: Date = new Date(),
) {
  const prisma = getPrismaClient();

  return prisma.workspace.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      installedAt,
      lastActiveAt: installedAt,
      uninstalledAt: null,
    },
    update: {
      installedAt,
      lastActiveAt: installedAt,
      uninstalledAt: null,
    },
  });
}

export async function markWorkspaceUninstalled(
  workspaceId: string,
  uninstalledAt: Date = new Date(),
) {
  const prisma = getPrismaClient();

  return prisma.workspace.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      installedAt: uninstalledAt,
      lastActiveAt: uninstalledAt,
      uninstalledAt,
    },
    update: {
      uninstalledAt,
      lastActiveAt: uninstalledAt,
    },
  });
}

export async function touchWorkspaceActivity(
  workspaceId: string,
  lastActiveAt: Date = new Date(),
) {
  const prisma = getPrismaClient();

  return prisma.workspace.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      installedAt: lastActiveAt,
      lastActiveAt,
      uninstalledAt: null,
    },
    update: {
      lastActiveAt,
      uninstalledAt: null,
    },
  });
}
