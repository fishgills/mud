/*
  Warnings:

  - A unique constraint covering the columns `[combatId]` on the table `CombatLog` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."CombatLog" ADD COLUMN     "combatId" TEXT,
ADD COLUMN     "log" JSONB,
ADD COLUMN     "runId" INTEGER,
ADD COLUMN     "runRound" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "CombatLog_combatId_key" ON "public"."CombatLog"("combatId");
