import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { AppError } from "../utils/AppError.js";

class TurmaProfessoresController {
  async create(req: Request, res: Response) {
    const paramsSchema = z.object({ turmaId: z.string().uuid() });
    const bodySchema = z.object({ professorId: z.string().uuid() });

    const { turmaId } = paramsSchema.parse(req.params);
    const { professorId } = bodySchema.parse(req.body);
    const { escolaId } = req.user;

    const turma = await prisma.turma.findFirst({
      where: { id: turmaId, escolaId },
    });
    if (!turma) throw new AppError("Turma não encontrada.", 404);

    const professor = await prisma.user.findFirst({
      where: {
        id: professorId,
        escolaId,
        role: "PROFESSOR",
        ativo: true,
      },
    });
    if (!professor) {
      throw new AppError("Professor ativo não encontrado nesta escola.", 404);
    }

    await prisma.turma.update({
      where: { id: turmaId },
      data: { professores: { connect: { id: professorId } } },
    });

    res.status(204).send();
  }

  async delete(req: Request, res: Response) {
    const paramsSchema = z.object({
      turmaId: z.string().uuid(),
      professorId: z.string().uuid(),
    });

    const { turmaId, professorId } = paramsSchema.parse(req.params);
    const { escolaId } = req.user;

    const turma = await prisma.turma.findFirst({
      where: { id: turmaId, escolaId },
    });
    if (!turma) throw new AppError("Turma não encontrada.", 404);

    await prisma.turma.update({
      where: { id: turmaId },
      data: { professores: { disconnect: { id: professorId } } },
    });

    res.status(204).send();
  }
}

export { TurmaProfessoresController };