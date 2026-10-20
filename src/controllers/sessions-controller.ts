import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { AppError } from "../utils/AppError.js";
import { compare } from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { authConfig } from "../configs/auth.js";

class SessionsController {
  async create(req: Request, res: Response, next: NextFunction) {
    const bodySchema = z.object({
      email: z.string().email({ message: "Formato de email inválido" }),
      password: z
        .string()
        .min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
    });

    const { email, password } = bodySchema.parse(req.body);

    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      throw new AppError("Email ou senha invalidos", 401);
    }

    const passwordMatch = await compare(password, user.password);

    if (!passwordMatch) {
      throw new AppError("Email ou senha invalidos", 401);
    }

    const { secret, expiresIn } = authConfig.jwt;

    const token = jwt.sign(
      {
        role: user.role,
        escolaId: user.escolaId,
      },
      secret,
      {
        subject: user.id,
        expiresIn,
      } as SignOptions,
    );

    // CORREÇÃO DE SEGURANÇA: Filtramos os dados sensíveis antes de enviar
    const userSeguro = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      escolaId: user.escolaId,
    };

    res.json({ token, user: userSeguro });
  }
}
export { SessionsController };
