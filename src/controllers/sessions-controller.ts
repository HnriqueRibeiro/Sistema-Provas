import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { createSessionToken } from "../services/auth-token-service.js";
import {
  clearLoginFailures,
  getLoginAttemptState,
  loginAttemptConfig,
  registerLoginFailure,
} from "../services/login-attempt-service.js";
import {
  normalizeEmail,
  verifyPassword,
} from "../services/password-service.js";

const DUMMY_PASSWORD_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

function invalidCredentialsMessage(attemptsRemaining: number) {
  if (attemptsRemaining === 1) {
    return "E-mail ou senha inválidos. Você tem mais 1 tentativa antes de um bloqueio temporário.";
  }

  return `E-mail ou senha inválidos. Você tem mais ${attemptsRemaining} tentativas antes de um bloqueio temporário.`;
}

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
    const ip = req.ip || "unknown";
    const attemptState = getLoginAttemptState(email, ip);

    if (attemptState.blocked) {
      res.setHeader("Retry-After", String(attemptState.retryAfterSeconds ?? 300));
      return res.status(429).json({
        message: `Você errou a senha ${loginAttemptConfig.maxFailedAttempts} vezes. Por segurança, o acesso foi bloqueado por ${loginAttemptConfig.blockDurationMinutes} minutos. Você também pode usar “Esqueceu sua senha?”.`,
        attemptsRemaining: 0,
        retryAfterSeconds: attemptState.retryAfterSeconds,
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      const failure = registerLoginFailure(email, ip);

      if (failure.blocked) {
        res.setHeader("Retry-After", String(failure.retryAfterSeconds ?? 300));
        return res.status(429).json({
          message: `Você errou a senha ${loginAttemptConfig.maxFailedAttempts} vezes. Por segurança, o acesso foi bloqueado por ${loginAttemptConfig.blockDurationMinutes} minutos. Você também pode usar “Esqueceu sua senha?”.`,
          attemptsRemaining: 0,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
      }

      return res.status(401).json({
        message: invalidCredentialsMessage(failure.attemptsRemaining),
        attemptsRemaining: failure.attemptsRemaining,
      });
    }

    const passwordMatch = await verifyPassword(password, user.password);

    if (!passwordMatch) {
      const failure = registerLoginFailure(email, ip);

      if (failure.blocked) {
        res.setHeader("Retry-After", String(failure.retryAfterSeconds ?? 300));
        return res.status(429).json({
          message: `Você errou a senha ${loginAttemptConfig.maxFailedAttempts} vezes. Por segurança, o acesso foi bloqueado por ${loginAttemptConfig.blockDurationMinutes} minutos. Você também pode usar “Esqueceu sua senha?”.`,
          attemptsRemaining: 0,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
      }

      return res.status(401).json({
        message: invalidCredentialsMessage(failure.attemptsRemaining),
        attemptsRemaining: failure.attemptsRemaining,
      });
    }

    if (!user.ativo) {
      clearLoginFailures(email, ip);
      return res.status(403).json({
        message: "Este acesso está desativado. Procure a coordenação da escola.",
      });
    }

    clearLoginFailures(email, ip);

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