/*
  Warnings:

  - A unique constraint covering the columns `[cpf]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cpf` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `data_nascimento` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sexo` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cpf" VARCHAR(11) NOT NULL,
ADD COLUMN     "data_nascimento" DATE NOT NULL,
ADD COLUMN     "sexo" VARCHAR(20) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");
