-- Sprint 1 / Fatia 1 - indices de performance (so leitura; nao altera dados)

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_tenant_id_user_id_created_at_idx" ON "notifications"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "imovel_photos_imovel_id_order_idx" ON "imovel_photos"("imovel_id", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "imoveis_tenant_id_created_at_idx" ON "imoveis"("tenant_id", "created_at");
