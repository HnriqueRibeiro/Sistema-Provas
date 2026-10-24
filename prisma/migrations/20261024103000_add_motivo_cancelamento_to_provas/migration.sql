-- Adiciona o motivo opcional de cancelamento/reprovação da prova.
ALTER TABLE "provas"
  ADD COLUMN "motivo_cancelamento" VARCHAR(500);
