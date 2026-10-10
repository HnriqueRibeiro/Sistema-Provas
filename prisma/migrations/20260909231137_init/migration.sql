-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PROFESSOR', 'COORDENADOR');

-- CreateEnum
CREATE TYPE "StatusProva" AS ENUM ('PENDENTE', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "Bimestre" AS ENUM ('PRIMEIRO', 'SEGUNDO', 'TERCEIRO', 'QUARTO');

-- CreateTable
CREATE TABLE "escolas" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,

    CONSTRAINT "escolas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" TEXT NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PROFESSOR',
    "escolaId" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provas" (
    "id" UUID NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" VARCHAR(500) NOT NULL,
    "status" "StatusProva" NOT NULL DEFAULT 'PENDENTE',
    "bimestre" "Bimestre" NOT NULL,
    "anoLetivo" VARCHAR(9) NOT NULL,
    "professorId" UUID NOT NULL,
    "turmaId" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "escolaId" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TurmaToUser" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TurmaToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "escolas_nome_key" ON "escolas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "turmas_nome_key" ON "turmas"("nome");

-- CreateIndex
CREATE INDEX "_TurmaToUser_B_index" ON "_TurmaToUser"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provas" ADD CONSTRAINT "provas_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provas" ADD CONSTRAINT "provas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TurmaToUser" ADD CONSTRAINT "_TurmaToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TurmaToUser" ADD CONSTRAINT "_TurmaToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
