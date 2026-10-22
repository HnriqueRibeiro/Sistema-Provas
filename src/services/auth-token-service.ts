import jwt, { SignOptions } from "jsonwebtoken";
import { authConfig } from "../configs/auth.js";
import { AppError } from "../utils/AppError.js";

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

export interface PasswordChangeTokenPayload {
  sub: string;
  purpose: "PASSWORD_CHANGE";
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

export function createPasswordChangeToken(user: Pick<SessionTokenUser, "id" | "tokenVersion">) {
  return jwt.sign(
    {
      purpose: "PASSWORD_CHANGE",
      tokenVersion: user.tokenVersion,
    },
    authConfig.passwordChangeToken.secret,
    {
      subject: user.id,
      expiresIn: authConfig.passwordChangeToken.expiresIn,
    } as SignOptions,
  );
}

export function verifyPasswordChangeToken(token: string): PasswordChangeTokenPayload {
  try {
    const payload = jwt.verify(
      token,
      authConfig.passwordChangeToken.secret,
    ) as PasswordChangeTokenPayload;

    if (
      payload.purpose !== "PASSWORD_CHANGE" ||
      typeof payload.sub !== "string" ||
      typeof payload.tokenVersion !== "number"
    ) {
      throw new Error("Invalid password change token payload");
    }

    return payload;
  } catch {
    throw new AppError("Token de primeiro acesso inválido ou expirado.", 401);
  }
}
