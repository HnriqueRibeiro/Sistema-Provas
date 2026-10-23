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

    const turmaAutorizada = await prisma.turma.findFirst({
      where: {
        id: turmaId,
        escolaId,
        professores: {
          some: { id: professorId },
        },
      },
      select: { id: true },
    });

    if (!turmaAutorizada) {
      throw new AppError(
        "Turma não encontrada ou não vinculada a este professor.",
        403,
      );
    }

    if (!req.file) {
      throw new AppError("O arquivo da prova é obrigatório.", 400);
    }

    const fileHash = crypto.randomBytes(10).toString("hex");
    const fileName = `${fileHash}-${req.file.originalname.replace(/\s/g, "_")}`;

    const { error: uploadError } = await supabase.storage
      .from("provas")
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) {
      console.error(uploadError);
      throw new AppError("Erro ao enviar o arquivo para a nuvem.", 500);
    }

    const { data: publicUrlData } = supabase.storage
      .from("provas")
      .getPublicUrl(fileName);

    const prova = await prisma.prova.create({
      data: {
        titulo,
        descricao,
        bimestre,
        anoLetivo,
        turmaId,
        professorId,
        arquivo_url: publicUrlData.publicUrl,
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

  async updateStatus(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const bodySchema = z.object({
      status: z.enum(["PENDENTE", "CONCLUIDA", "CANCELADA"]),
      motivoCancelamento: z.string().optional().nullable(),
    });

    const { id } = paramsSchema.parse(req.params);
    const { status, motivoCancelamento } = bodySchema.parse(req.body);
    const { role, escolaId } = req.user;

    if (role !== "COORDENADOR") {
      throw new AppError("Apenas coordenadores podem avaliar provas.", 403);
    }

    const prova = await prisma.prova.findFirst({
      where: { id, turma: { escolaId } },
    });

    if (!prova) {
      throw new AppError("Prova não encontrada.", 404);
    }

    const provaAtualizada = await prisma.prova.update({
      where: { id },
      data: {
        status,
        motivo_cancelamento: status === "CANCELADA" ? motivoCancelamento : null,
      },
    });

    res.json(provaAtualizada);
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

    await prisma.prova.delete({ where: { id } });

    const fileName = prova.arquivo_url.split("/").pop();

    if (fileName) {
      await supabase.storage.from("provas").remove([fileName]);
    }

    res.status(204).send();
  }
}

export { ProvasController };
