import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { objectStorageService } from "../services/object-storage-service.js";
import { AppError } from "../utils/AppError.js";

async function exposeFileUrl<
  T extends {
    arquivo_key: string | null;
    arquivo_url: string | null;
    [key: string]: unknown;
  },
>(prova: T) {
  const { arquivo_key, ...safeProva } = prova;

  const arquivoUrl = arquivo_key
    ? await objectStorageService.createSignedReadUrl(arquivo_key)
    : prova.arquivo_url;

  return {
    ...safeProva,
    arquivo_url: arquivoUrl ?? "",
  };
}

class ProvasController {
  async create(req: Request, res: Response) {
    const bodySchema = z.object({
      titulo: z.string().trim().min(1).max(255),
      descricao: z.string().trim().min(1).max(500),
      bimestre: z.enum(["PRIMEIRO", "SEGUNDO", "TERCEIRO", "QUARTO"]),
      anoLetivo: z.string().trim().min(4).max(9),
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

    const arquivoKey = objectStorageService.buildProofKey(
      escolaId,
      req.file.mimetype,
    );
    const arquivoNomeOriginal = objectStorageService.normalizeOriginalFileName(
      req.file.originalname,
    );

    try {
      await objectStorageService.upload({
        key: arquivoKey,
        body: req.file.buffer,
        contentType: req.file.mimetype,
        originalFileName: arquivoNomeOriginal,
      });
    } catch (error) {
      console.error("R2_UPLOAD_FAILED", error instanceof Error ? error.message : "unknown");
      throw new AppError("Erro ao enviar o arquivo da prova.", 500);
    }

    try {
      const prova = await prisma.prova.create({
        data: {
          titulo,
          descricao,
          bimestre,
          anoLetivo,
          turmaId,
          professorId,
          arquivo_url: null,
          arquivo_key: arquivoKey,
          arquivo_nome_original: arquivoNomeOriginal,
          arquivo_mime_type: req.file.mimetype,
          arquivo_tamanho: req.file.size,
        },
      });

      return res.status(201).json(await exposeFileUrl(prova));
    } catch (error) {
      try {
        await objectStorageService.delete(arquivoKey);
      } catch (cleanupError) {
        console.error(
          "R2_ORPHAN_CLEANUP_FAILED",
          cleanupError instanceof Error ? cleanupError.message : "unknown",
        );
      }

      throw error;
    }
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

    const provasComArquivo = await Promise.all(provas.map(exposeFileUrl));
    return res.json(provasComArquivo);
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

    return res.json(await exposeFileUrl(prova));
  }

  async updateStatus(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const bodySchema = z.object({
      status: z.enum(["PENDENTE", "CONCLUIDA", "CANCELADA"]),
      motivoCancelamento: z.string().max(500).optional().nullable(),
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

    return res.json(await exposeFileUrl(provaAtualizada));
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

    if (prova.arquivo_key) {
      try {
        await objectStorageService.delete(prova.arquivo_key);
      } catch (error) {
        console.error(
          "R2_DELETE_FAILED",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }

    return res.status(204).send();
  }
}

export { ProvasController };
