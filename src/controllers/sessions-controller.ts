import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { AppError } from "../utils/AppError.js";
import {
  createPasswordChangeToken,
  createSessionToken,
} from "../services/auth-token-service.js";
import {
  normalizeEmail,
  verifyPassword,
} from "../services/password-service.js";

const DUMMY_PASSWORD_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

class SessionsController {
  async create(req: Request, res: Response) {
    const bodySchema = z.object({
      email: z
        .string()
        .trim()
        .email({ message: "Formato de e-mail inválido" })
        .transform((value) => normalizeEmail(value)),
      password: z.string().min(1, { message: "Senha obrigatória" }).max(72),
    });

    const { email, password } = bodySchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      throw new AppError("E-mail ou senha inválidos.", 401);
    }

    const passwordMatch = await verifyPassword(password, user.password);

    if (!passwordMatch) {
      throw new AppError("E-mail ou senha inválidos.", 401);
    }

    if (user.mustChangePassword) {
      const now = new Date();

      if (
        !user.temporaryPasswordExpiresAt ||
        user.temporaryPasswordExpiresAt <= now
      ) {
        throw new AppError(
          "Seu acesso temporário expirou. Procure a coordenação da escola para gerar um novo acesso.",
          401,
        );
      }

      return res.json({
        requiresPasswordChange: true,
        passwordChangeToken: createPasswordChangeToken(user),
      });
    }

    const token = createSessionToken(user);

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      escolaId: user.escolaId,
    };

    return res.json({ token, user: safeUser });
  }
}

export { SessionsController };
