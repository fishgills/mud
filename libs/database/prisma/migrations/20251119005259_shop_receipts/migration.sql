-- DropForeignKey
ALTER TABLE "public"."ShopCatalogItem" DROP CONSTRAINT "ShopCatalogItem_itemTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TransactionReceipt" DROP CONSTRAINT "TransactionReceipt_playerItemId_fkey";

-- AddForeignKey
ALTER TABLE "public"."ShopCatalogItem" ADD CONSTRAINT "ShopCatalogItem_itemTemplateId_fkey" FOREIGN KEY ("itemTemplateId") REFERENCES "public"."Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransactionReceipt" ADD CONSTRAINT "TransactionReceipt_playerItemId_fkey" FOREIGN KEY ("playerItemId") REFERENCES "public"."PlayerItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
