/*
  Warnings:

  - Added the required column `arquivo_url` to the `provas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "provas" ADD COLUMN     "arquivo_url" VARCHAR(500) NOT NULL;
