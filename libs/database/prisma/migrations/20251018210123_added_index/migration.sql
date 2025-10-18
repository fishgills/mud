-- CreateIndex
CREATE INDEX "Monster_isAlive_x_y_idx" ON "public"."Monster"("isAlive", "x", "y");

-- CreateIndex
CREATE INDEX "Monster_x_y_idx" ON "public"."Monster"("x", "y");
