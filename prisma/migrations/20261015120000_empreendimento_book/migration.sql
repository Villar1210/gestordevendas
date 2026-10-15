-- Book do empreendimento (Fatia 2): PDF original + todas as paginas em JPG.
-- So tabelas NOVAS - nenhuma tabela existente e alterada.

-- CreateTable
CREATE TABLE "empreendimento_books" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "empreendimento_id" UUID NOT NULL,
    "origem" VARCHAR(10) NOT NULL,
    "pdf_url" VARCHAR(500),
    "pdf_nome_original" VARCHAR(200),
    "total_paginas" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empreendimento_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empreendimento_book_paginas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "categoria" VARCHAR(20) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "largura" INTEGER NOT NULL,
    "altura" INTEGER NOT NULL,

    CONSTRAINT "empreendimento_book_paginas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empreendimento_books_empreendimento_id_key" ON "empreendimento_books"("empreendimento_id");

-- CreateIndex
CREATE INDEX "empreendimento_books_tenant_id_idx" ON "empreendimento_books"("tenant_id");

-- CreateIndex
CREATE INDEX "empreendimento_book_paginas_tenant_id_idx" ON "empreendimento_book_paginas"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "empreendimento_book_paginas_book_id_numero_key" ON "empreendimento_book_paginas"("book_id", "numero");

-- AddForeignKey
ALTER TABLE "empreendimento_books" ADD CONSTRAINT "empreendimento_books_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empreendimento_books" ADD CONSTRAINT "empreendimento_books_empreendimento_id_fkey" FOREIGN KEY ("empreendimento_id") REFERENCES "empreendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empreendimento_book_paginas" ADD CONSTRAINT "empreendimento_book_paginas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empreendimento_book_paginas" ADD CONSTRAINT "empreendimento_book_paginas_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "empreendimento_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
