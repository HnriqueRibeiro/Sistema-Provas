import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import {
  hashPassword,
  normalizeEmail,
} from "../services/password-service.js";
import { AppError } from "../utils/AppError.js";
import { isValidCpf, normalizeCpf } from "../utils/cpf.js";

const userBodySchema = z.object({
  name: z.string().trim().min(3, { message: "Informe o nome completo" }),
  email: z
    .string()
    .trim()
    .email({ message: "E-mail inválido" })
    .transform((value) => normalizeEmail(value)),
  cpf: z
    .string()
    .transform((value) => normalizeCpf(value))
    .refine((value) => isValidCpf(value), { message: "CPF inválido" }),
  data_nascimento: z.coerce.date({ message: "Data de nascimento inválida" }),
  sexo: z.enum(["MASCULINO", "FEMININO"]),
  role: z.enum(["PROFESSOR", "COORDENADOR"]).default("PROFESSOR"),
});

const userUpdateSchema = z
  .object({
    name: z.string().trim().min(3, { message: "Informe o nome completo" }).optional(),
    email: z
      .string()
      .trim()
      .email({ message: "E-mail inválido" })
      .transform((value) => normalizeEmail(value))
      .optional(),
    cpf: z
      .string()
      .transform((value) => normalizeCpf(value))
      .refine((value) => isValidCpf(value), { message: "CPF inválido" })
      .optional(),
    data_nascimento: z.coerce.date({ message: "Data de nascimento inválida" }).optional(),
    sexo: z.enum(["MASCULINO", "FEMININO"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualização.",
  });

const statusSchema = z.object({
  ativo: z.boolean(),
});

class UsersController {
  async create(req: Request, res: Response) {
    const { name, email, cpf, data_nascimento, sexo, role } = userBodySchema.parse(
      req.body,
    );
    const { escolaId } = req.user;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { cpf }],
      },
      select: { email: true, cpf: true },
    });

    if (existingUser?.email === email) {
      throw new AppError("E-mail já cadastrado.", 400);
    }

    if (existingUser?.cpf === cpf) {
      throw new AppError("CPF já cadastrado.", 400);
    }

    // Sistema fechado: o CPF somente com números é a senha inicial.
    // O valor nunca é salvo em texto puro; apenas o hash bcrypt vai para o banco.
    const passwordHash = await hashPassword(cpf);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        cpf,
        data_nascimento,
        sexo,
        password: passwordHash,
        role,
        escolaId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        ativo: true,
      },
    });

    return res.status(201).json(user);
  }

  async index(req: Request, res: Response) {
    const { escolaId } = req.user;

    const users = await prisma.user.findMany({
      where: { escolaId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        ativo: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.json(users);
  }

  async indexProfessores(req: Request, res: Response) {
    const { escolaId } = req.user;

    const professores = await prisma.user.findMany({
      where: {
        escolaId,
        role: "PROFESSOR",
        ativo: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.json(professores);
  }

  async show(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);
    const { escolaId } = req.user;

    const user = await prisma.user.findFirst({
      where: { id, escolaId },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        data_nascimento: true,
        sexo: true,
        role: true,
        ativo: true,
      },
    });

    if (!user) {
      throw new AppError("Usuário não encontrado.", 404);
    }

    return res.json(user);
  }

  async update(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);
    const data = userUpdateSchema.parse(req.body);
    const { escolaId } = req.user;

    const user = await prisma.user.findFirst({
      where: { id, escolaId },
      select: { id: true },
    });

    if (!user) {
      throw new AppError("Usuário não encontrado.", 404);
    }

    if (data.email || data.cpf) {
      const duplicate = await prisma.user.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(data.email ? [{ email: data.email }] : []),
            ...(data.cpf ? [{ cpf: data.cpf }] : []),
          ],
        },
        select: { email: true, cpf: true },
      });

      if (data.email && duplicate?.email === data.email) {
        throw new AppError("E-mail já cadastrado.", 400);
      }

      if (data.cpf && duplicate?.cpf === data.cpf) {
        throw new AppError("CPF já cadastrado.", 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        sexo: true,
        data_nascimento: true,
        role: true,
        ativo: true,
      },
    });

    return res.json(updatedUser);
  }

  async updateStatus(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);
    const { ativo } = statusSchema.parse(req.body);
    const { escolaId, id: requesterId } = req.user;

    const user = await prisma.user.findFirst({
      where: { id, escolaId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        ativo: true,
      },
    });

    if (!user) {
      throw new AppError("Usuário não encontrado.", 404);
    }

    if (!ativo && user.id === requesterId) {
      throw new AppError("Você não pode desativar o seu próprio acesso.", 400);
    }

    if (!ativo && user.role === "COORDENADOR" && user.ativo) {
      const activeCoordinators = await prisma.user.count({
        where: {
          escolaId,
          role: "COORDENADOR",
          ativo: true,
        },
      });

      if (activeCoordinators <= 1) {
        throw new AppError(
          "Não é possível desativar o único coordenador ativo da escola.",
          400,
        );
      }
    }

    if (user.ativo === ativo) {
      return res.json(user);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: ativo
        ? { ativo: true }
        : {
            ativo: false,
            tokenVersion: { increment: 1 },
          },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        ativo: true,
      },
    });

    return res.json(updatedUser);
  }

  // Mantido para compatibilidade administrativa: exclusão definitiva somente de professor sem provas.
  async delete(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);
    const { escolaId } = req.user;

    const professor = await prisma.user.findFirst({
      where: { id, escolaId, role: "PROFESSOR" },
      select: { id: true },
    });

    if (!professor) {
      throw new AppError("Professor não encontrado.", 404);
    }

    const provasDoProfessor = await prisma.prova.count({
      where: { professorId: id },
    });

    if (provasDoProfessor > 0) {
      throw new AppError(
        "Este professor não pode ser excluído pois já possui provas enviadas no sistema.",
        400,
      );
    }

    await prisma.user.delete({ where: { id } });
    return res.status(204).send();
  }
}

export { UsersController };