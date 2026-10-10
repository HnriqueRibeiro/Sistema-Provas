import jwt from "jsonwebtoken";
import { authConfig } from "../configs/auth.js";
import { AppError } from "../utils/AppError.js";
import { Request, Response, NextFunction } from "express";

interface TokenPayload {
  role: string;
  sub: string;
  escolaId: string;
}

function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError("JWT token not found", 401);
    }

    const [, token] = authHeader.split(" ");

    const {
      role,
      sub: user_id,
      escolaId,
    } = jwt.verify(token, authConfig.jwt.secret) as TokenPayload;

    // A linha vermelha vai aparecer aqui temporariamente. Vamos resolvê-la no Passo 2.
    req.user = {
      id: user_id,
      role,
      escolaId,
    };
    return next();
  } catch (error) {
    throw new AppError("Invalid JWT token", 401);
  }
}

export { ensureAuthenticated };
