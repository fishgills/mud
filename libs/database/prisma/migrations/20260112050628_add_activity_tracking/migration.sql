-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "hasDefeatedMonster" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasStartedGame" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "totalCommandsExecuted" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."Workspace" (
    "id" SERIAL NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_workspaceId_key" ON "public"."Workspace"("workspaceId");

-- CreateIndex
CREATE INDEX "Workspace_workspaceId_idx" ON "public"."Workspace"("workspaceId");
