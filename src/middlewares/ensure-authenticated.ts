import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { authConfig } from "../configs/auth.js";
import { prisma } from "../database/prisma.js";
import { AppError } from "../utils/AppError.js";
import type { SessionTokenPayload } from "../services/auth-token-service.js";

async function ensureAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError("JWT token não encontrado.", 401);
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new AppError("JWT token inválido.", 401);
    }

    const payload = jwt.verify(
      token,
      authConfig.jwt.secret,
    ) as SessionTokenPayload;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.tokenVersion !== "number"
    ) {
      throw new AppError("JWT token inválido.", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        escolaId: true,
        tokenVersion: true,
        ativo: true,
      },
    });

    if (
      !user ||
      !user.ativo ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      throw new AppError("Sessão inválida ou encerrada.", 401);
    }

    req.user = {
      id: user.id,
      role: user.role,
      escolaId: user.escolaId,
    };

    return next();
  } catch {
    throw new AppError("Sessão inválida ou expirada.", 401);
  }
}

export { ensureAuthenticated };