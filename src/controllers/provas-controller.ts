import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { AppError } from "../utils/AppError.js";
import { supabase } from "../database/supabase.js";
import crypto from "node:crypto";

class ProvasController {
  async create(req: Request, res: Response) {
    const bodySchema = z.object({
      titulo: z.string(),
      descricao: z.string(),
      bimestre: z.enum(["PRIMEIRO", "SEGUNDO", "TERCEIRO", "QUARTO"]),
      anoLetivo: z.string(),
      turmaId: z.string().uuid(),
    });

    const { titulo, descricao, bimestre, anoLetivo, turmaId } =
      bodySchema.parse(req.body);
    const { id: professorId, escolaId } = req.user;

    if (!req.file) {
      throw new AppError("O arquivo da prova é obrigatório.", 400);
    }

    // 1. Cria um nome único sem espaços para o arquivo
    const fileHash = crypto.randomBytes(10).toString("hex");
    const fileName = `${fileHash}-${req.file.originalname.replace(/\s/g, "_")}`;

    // 2. Envia o arquivo da Memória RAM (buffer) direto para o bucket "provas" no Supabase
    const { error: uploadError } = await supabase.storage
      .from("provas")
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) {
      console.error(uploadError);
      throw new AppError("Erro ao enviar o arquivo para a nuvem.", 500);
    }

    // 3. Pega o Link Público oficial do arquivo gerado pelo Supabase
    const { data: publicUrlData } = supabase.storage
      .from("provas")
      .getPublicUrl(fileName);

    // 4. Salva no banco de dados com a URL completa da nuvem
    const prova = await prisma.prova.create({
      data: {
        titulo,
        descricao,
        bimestre,
        anoLetivo,
        turmaId,
        professorId,
        arquivo_url: publicUrlData.publicUrl, // Salvando o link real da internet
      },
    });

    res.status(201).json(prova);
  }

  async index(req: Request, res: Response) {
    const { role, id: userId, escolaId } = req.user;

    const provas = await prisma.prova.findMany({
      where: {
        turma: { escolaId },
        ...(role === "PROFESSOR" ? { professorId: userId } : {}),
      },
      include: {
        turma: { select: { nome: true } },
        professor: { select: { name: true } },
      },
      orderBy: { create_at: "desc" },
    });

    res.json(provas);
  }

  async show(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);
    const { role, id: userId, escolaId } = req.user;

    const prova = await prisma.prova.findFirst({
      where: {
        id,
        turma: { escolaId },
        ...(role === "PROFESSOR" ? { professorId: userId } : {}),
      },
      include: { turma: true, professor: { select: { name: true } } },
    });

    if (!prova) {
      throw new AppError(
        "Prova não encontrada ou sem permissão de acesso.",
        404,
      );
    }

    res.json(prova);
  }

  async delete(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);
    const { role, id: userId, escolaId } = req.user;

    const prova = await prisma.prova.findFirst({
      where: {
        id,
        turma: { escolaId },
        ...(role === "PROFESSOR" ? { professorId: userId } : {}),
      },
    });

    if (!prova) {
      throw new AppError(
        "Prova não encontrada ou sem permissão para exclusão.",
        404,
      );
    }

    // 1. Deleta do Prisma
    await prisma.prova.delete({ where: { id } });

    // 2. Extrai o nome real do arquivo no final do link para poder apagar da nuvem
    const fileName = prova.arquivo_url.split("/").pop();

    if (fileName) {
      // 3. Deleta o arquivo do Supabase
      await supabase.storage.from("provas").remove([fileName]);
    }

    res.status(204).send();
  }
}

export { ProvasController };
