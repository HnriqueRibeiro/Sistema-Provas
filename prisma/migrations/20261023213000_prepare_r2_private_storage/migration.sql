-- Mantém arquivo_url temporariamente para compatibilidade com registros antigos.
-- Novos uploads usam arquivo_key e URLs assinadas são geradas somente sob demanda.
ALTER TABLE "provas"
  ALTER COLUMN "arquivo_url" DROP NOT NULL,
  ADD COLUMN "arquivo_key" VARCHAR(500),
  ADD COLUMN "arquivo_nome_original" VARCHAR(255),
  ADD COLUMN "arquivo_mime_type" VARCHAR(150),
  ADD COLUMN "arquivo_tamanho" INTEGER;

CREATE INDEX "provas_arquivo_key_idx" ON "provas"("arquivo_key");
