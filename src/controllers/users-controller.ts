import { Request, Response } from "express";
import { z } from "zod";
import { authConfig } from "../configs/auth.js";
import { prisma } from "../database/prisma.js";
import {
  assertPasswordPolicy,
  generateTemporaryPassword,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "../services/password-service.js";
import { AppError } from "../utils/AppError.js";
import { isValidCpf, normalizeCpf } from "../utils/cpf.js";

const professorBodySchema = z.object({
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
});

const professorUpdateSchema = z
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

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

class UsersController {
  async create(req: Request, res: Response) {
    const { name, email, cpf, data_nascimento, sexo } = professorBodySchema.parse(
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

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const temporaryPasswordExpiresAt = addHours(
      new Date(),
      authConfig.temporaryPasswordExpiresInHours,
    );

    const user = await prisma.user.create({
      data: {
        name,
        email,
        cpf,
        data_nascimento,
        sexo,
        password: passwordHash,
        role: "PROFESSOR",
        escolaId,
        mustChangePassword: true,
        temporaryPasswordExpiresAt,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return res.status(201).json({
      user,
      temporaryPassword,
      temporaryPasswordExpiresAt,
    });
  }

  async index(req: Request, res: Response) {
    const { escolaId } = req.user;

    const professores = await prisma.user.findMany({
      where: {
        escolaId,
        role: "PROFESSOR",
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

    const professor = await prisma.user.findFirst({
      where: { id, escolaId, role: "PROFESSOR" },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        data_nascimento: true,
        sexo: true,
      },
    });

    if (!professor) {
      throw new AppError("Professor não encontrado.", 404);
    }

    return res.json(professor);
  }

  async update(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);
    const data = professorUpdateSchema.parse(req.body);
    const { escolaId } = req.user;

    const professor = await prisma.user.findFirst({
      where: { id, escolaId, role: "PROFESSOR" },
      select: { id: true },
    });

    if (!professor) {
      throw new AppError("Professor não encontrado.", 404);
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

    const updatedProfessor = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        sexo: true,
        data_nascimento: true,
      },
    });

    return res.json(updatedProfessor);
  }

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

  async resetAccess(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        escolaId: true,
      },
    });

    if (!targetUser) {
      throw new AppError("Usuário não encontrado.", 404);
    }

    if (targetUser.role !== "PROFESSOR") {
      throw new AppError(
        "Coordenadores não podem redefinir o acesso de outro coordenador.",
        403,
      );
    }

    if (targetUser.escolaId !== req.user.escolaId) {
      throw new AppError(
        "Você não possui permissão para administrar este professor.",
        403,
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const expiresAt = addHours(
      new Date(),
      authConfig.temporaryPasswordExpiresInHours,
    );
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUser.id },
        data: {
          password: passwordHash,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: expiresAt,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: targetUser.id, usedAt: null },
        data: { usedAt: now },
      }),
    ]);

    console.info("ADMIN_ACCESS_RESET");

    return res.json({
      temporaryPassword,
      expiresAt,
    });
  }

  async changePassword(req: Request, res: Response) {
    const bodySchema = z.object({
      currentPassword: z.string().min(1).max(72),
      newPassword: z.string().min(1).max(72),
    });

    const { currentPassword, newPassword } = bodySchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      throw new AppError("Usuário não encontrado.", 404);
    }

    const currentPasswordMatches = await verifyPassword(
      currentPassword,
      user.password,
    );

    if (!currentPasswordMatches) {
      throw new AppError("Senha atual inválida.", 401);
    }

    await assertPasswordPolicy(newPassword, {
      cpf: user.cpf,
      email: user.email,
      currentPasswordHash: user.password,
    });

    const passwordHash = await hashPassword(newPassword);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: passwordHash,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          passwordChangedAt: now,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
    ]);

    console.info("PASSWORD_CHANGED");

    return res.json({
      message: "Senha alterada com sucesso. Entre novamente com a nova senha.",
      requiresLogin: true,
    });
  }
}

export { UsersController };
