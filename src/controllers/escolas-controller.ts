import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { AppError } from "../utils/AppError.js";

class EscolasController {
  async create(req: Request, res: Response, next: NextFunction) {
    const bodySchema = z.object({
      nome: z.string().trim().min(3, {
        message: "O nome é nescessário e deve ter no mínimo 3 caracteres.",
      }),
    });

    const { nome } = bodySchema.parse(req.body);
    const escolaAlreadyExists = await prisma.escola.findUnique({
      where: { nome },
    });

    if (escolaAlreadyExists) {
      throw new AppError("Já existe uma escola com esse nome.", 400);
    }

    const escola = await prisma.escola.create({
      data: {
        nome,
      },
    });
    res.status(201).json(escola);
  }
}

export { EscolasController };
