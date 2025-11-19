ALTER TABLE "public"."ShopCatalogItem"
  ADD COLUMN IF NOT EXISTS "itemTemplateId" INTEGER REFERENCES "public"."Item"("id") ON DELETE SET NULL;

ALTER TABLE "public"."TransactionReceipt"
  ADD COLUMN IF NOT EXISTS "playerItemId" INTEGER REFERENCES "public"."PlayerItem"("id") ON DELETE SET NULL;
