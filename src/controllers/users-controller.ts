import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { hash } from "bcrypt";
import { prisma } from "../database/prisma.js";
import { AppError } from "../utils/AppError.js";

class UsersController {
  async create(req: Request, res: Response, next: NextFunction) {
    const bodySchema = z.object({
      name: z.string().trim().min(3, { message: "Name is required" }),
      email: z.string().email({ message: "Invalid email format" }),

      // Transform limpa os pontos do CPF caso o frontend mande com máscara
      cpf: z
        .string()
        .trim()
        .transform((val) => val.replace(/\D/g, "")),

      data_nascimento: z.coerce.date({ message: "Invalid date format" }),
      sexo: z.enum(["MASCULINO", "FEMININO"]),

      // Deixamos opcionais para a coordenadora não precisar preencher no futuro
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

    // LÓGICA INTELIGENTE: Pega o ID que você mandou no Insomnia OU pega do Token de quem está logado
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

    // LÓGICA INTELIGENTE: Se você mandar senha, usa ela. Se a coordenadora não mandar, usa o CPF como padrão.
    const senhaFinal = passwordDoBody ? passwordDoBody : cpf;
    const hashedPassword = await hash(senhaFinal, 8);

    // LÓGICA INTELIGENTE: Se você mandar o role, ele obedece. Se não mandar, vira professor.
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
        role: roleFinal, // Agora sim o seu Coordenador nasce como Coordenador!
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    return res.status(201).json(userWithoutPassword);
  }

  async index(req: Request, res: Response) {
    const { escolaId } = req.user;

    // Busca apenas os professores que pertencem à escola do coordenador logado
    const professores = await prisma.user.findMany({
      where: {
        escolaId,
        role: "PROFESSOR",
      },
      // Seleciona apenas dados seguros (não traz a senha)
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return res.json(professores);
  }
}

export { UsersController };
