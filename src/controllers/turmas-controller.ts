import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { AppError } from "../utils/AppError.js";

class TurmasController {
  async create(req: Request, res: Response, next: NextFunction) {
    const bodySchema = z.object({
      nome: z.string().trim().min(2, {
        message: "O nome da turma deve ter no mínimo 2 caracteres.",
      }),
    });

    const { nome } = bodySchema.parse(req.body);

    // Extrai o ID da escola diretamente do token do coordenador logado
    const { escolaId } = req.user;

    const turmaAlreadyExists = await prisma.turma.findUnique({
      where: { nome },
    });

    if (turmaAlreadyExists) {
      throw new AppError("Já existe uma turma cadastrada com este nome.", 400);
    }

    const turma = await prisma.turma.create({
      data: {
        nome,
        escolaId,
      },
    });

    res.status(201).json(turma);
  }

  async index(req: Request, res: Response) {
    const { escolaId, role, id: userId } = req.user;

    const turmas = await prisma.turma.findMany({
      where: {
        escolaId,
        // Se for professor, filtra apenas as turmas dele. Se não, não aplica esse filtro.
        ...(role === "PROFESSOR"
          ? { professores: { some: { id: userId } } }
          : {}),
      },
      include: {
        _count: { select: { professores: true, provas: true } }, // Traz o total de professores e provas
      },
    });

    res.json(turmas);
  }

  async show(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);

    // Agora extraímos a role e o userId de quem está logado
    const { escolaId, role, id: userId } = req.user;

    const turma = await prisma.turma.findFirst({
      where: {
        id,
        escolaId,
        // TRAVA DE SEGURANÇA: Se for professor, o banco só acha a turma se ele estiver nela!
        ...(role === "PROFESSOR"
          ? { professores: { some: { id: userId } } }
          : {}),
      },
      include: {
        professores: { select: { id: true, name: true, email: true } },
      },
    });

    if (!turma) {
      throw new AppError(
        "Turma não encontrada ou você não tem permissão de acessá-la.",
        404,
      );
    }

    res.json(turma);
  }

  async update(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const bodySchema = z.object({ nome: z.string().trim().min(2) });

    const { id } = paramsSchema.parse(req.params);
    const { nome } = bodySchema.parse(req.body);
    const { escolaId } = req.user;

    const turmaExists = await prisma.turma.findFirst({
      where: { id, escolaId },
    });

    if (!turmaExists) {
      throw new AppError("Turma não encontrada.", 404);
    }

    // Verifica se o novo nome já está em uso por outra turma
    const nomeInUse = await prisma.turma.findFirst({
      where: { nome, id: { not: id } },
    });

    if (nomeInUse) {
      throw new AppError(
        "Já existe outra turma cadastrada com este nome.",
        400,
      );
    }

    const turma = await prisma.turma.update({
      where: { id },
      data: { nome },
    });

    res.json(turma);
  }

  async delete(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);
    const { escolaId } = req.user;

    const turmaExists = await prisma.turma.findFirst({
      where: { id, escolaId },
    });

    if (!turmaExists) {
      throw new AppError("Turma não encontrada.", 404);
    }

    await prisma.turma.delete({ where: { id } });

    res.status(204).send(); // 204 = No Content (sucesso sem corpo na resposta)
  }
}

export { TurmasController };
