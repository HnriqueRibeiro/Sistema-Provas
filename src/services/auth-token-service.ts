import jwt, { SignOptions } from "jsonwebtoken";
import { authConfig } from "../configs/auth.js";

interface SessionTokenUser {
  id: string;
  role: string;
  escolaId: string;
  tokenVersion: number;
}

export interface SessionTokenPayload {
  sub: string;
  role: string;
  escolaId: string;
  tokenVersion: number;
}

export function createSessionToken(user: SessionTokenUser) {
  return jwt.sign(
    {
      role: user.role,
      escolaId: user.escolaId,
      tokenVersion: user.tokenVersion,
    },
    authConfig.jwt.secret,
    {
      subject: user.id,
      expiresIn: authConfig.jwt.expiresIn,
    } as SignOptions,
  );
}
