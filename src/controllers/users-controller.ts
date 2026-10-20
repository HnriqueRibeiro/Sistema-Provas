import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { hash } from "bcrypt";
import { prisma } from "../database/prisma.js";
import { AppError } from "../utils/AppError.js";

function cpfValido(value: string) {
  const cpf = value.replace(/\D/g, "");

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const calcularDigito = (quantidade: number) => {
    let soma = 0;

    for (let i = 0; i < quantidade; i += 1) {
      soma += Number(cpf[i]) * (quantidade + 1 - i);
    }

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return (
    calcularDigito(9) === Number(cpf[9]) &&
    calcularDigito(10) === Number(cpf[10])
  );
}

class UsersController {
  async create(req: Request, res: Response, next: NextFunction) {
    const bodySchema = z.object({
      name: z.string().trim().min(3, { message: "Name is required" }),
      email: z.string().email({ message: "Invalid email format" }),

      cpf: z
        .string()
        .trim()
        .transform((val) => val.replace(/\D/g, ""))
        .refine((val) => cpfValido(val), { message: "CPF inválido" }),

      data_nascimento: z.coerce.date({ message: "Invalid date format" }),
      sexo: z.enum(["MASCULINO", "FEMININO"]),

      escolaId: z.string().uuid().optional(),
      role: z.enum(["PROFESSOR", "COORDENADOR"]).optional(),
      password: z.string().min(6).optional(),
    });

    const {
      name,
      email,
      cpf,
      data_nascimento,
      sexo,
      escolaId: escolaIdDoBody,
      role: roleDoBody,
      password: passwordDoBody,
    } = bodySchema.parse(req.body);

    const escolaIdFinal = escolaIdDoBody || (req as any).user?.escolaId;

    if (!escolaIdFinal) {
      throw new AppError(
        "É obrigatório informar a escola ou estar logado em uma.",
        401,
      );
    }

    const userWithSameEmail = await prisma.user.findFirst({ where: { email } });

    if (userWithSameEmail) {
      throw new AppError("E-mail já cadastrado", 400);
    }

    const senhaFinal = passwordDoBody ? passwordDoBody : cpf;
    const hashedPassword = await hash(senhaFinal, 8);
    const roleFinal = roleDoBody || "PROFESSOR";

    const user = await prisma.user.create({
      data: {
        name,
        email,
        cpf,
        data_nascimento,
        sexo,
        password: hashedPassword,
        escolaId: escolaIdFinal,
        role: roleFinal,
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    return res.status(201).json(userWithoutPassword);
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
        cpf: true,
        sexo: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const professoresSeguros = professores.map((professor) => ({
      id: professor.id,
      name: professor.name,
      email: professor.email,
      cpf: `***.***.***-${professor.cpf.slice(-2)}`,
      sexo: professor.sexo,
    }));

    return res.json(professoresSeguros);
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

    if (!professor) throw new AppError("Professor não encontrado.", 404);
    return res.json(professor);
  }

  async update(req: Request, res: Response) {
    const paramsSchema = z.object({ id: z.string().uuid() });

    // Adicionamos CPF, Data de Nascimento e Sexo aqui!
    const bodySchema = z.object({
      name: z.string().trim().min(3).optional(),
      email: z.string().email().optional(),
      cpf: z
        .string()
        .trim()
        .transform((val) => val.replace(/\D/g, ""))
        .optional(),
      data_nascimento: z.coerce.date().optional(),
      sexo: z.enum(["MASCULINO", "FEMININO"]).optional(),
    });

    const { id } = paramsSchema.parse(req.params);
    const data = bodySchema.parse(req.body);
    const { escolaId } = req.user;

    const professor = await prisma.user.findFirst({
      where: { id, escolaId, role: "PROFESSOR" },
    });
    if (!professor) throw new AppError("Professor não encontrado.", 404);

    const updatedProfessor = await prisma.user.update({
      where: { id },
      data, // Passa todos os dados que vieram do frontend
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
    });
    if (!professor) throw new AppError("Professor não encontrado.", 404);

    // Regra de Ouro: Não podemos apagar um professor que já tem provas no sistema!
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
