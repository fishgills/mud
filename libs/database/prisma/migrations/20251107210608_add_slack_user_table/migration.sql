-- CreateTable
CREATE TABLE "public"."SlackUser" (
    "id" SERIAL NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlackUser_playerId_idx" ON "public"."SlackUser"("playerId");

-- CreateIndex
CREATE INDEX "SlackUser_teamId_idx" ON "public"."SlackUser"("teamId");

-- CreateIndex
CREATE INDEX "SlackUser_userId_idx" ON "public"."SlackUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SlackUser_teamId_userId_key" ON "public"."SlackUser"("teamId", "userId");

-- AddForeignKey
ALTER TABLE "public"."SlackUser" ADD CONSTRAINT "SlackUser_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
