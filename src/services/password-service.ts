import { randomBytes } from "node:crypto";
import { compare, hash } from "bcrypt";
import { env } from "../env.js";
import { AppError } from "../utils/AppError.js";
import { normalizeCpf } from "../utils/cpf.js";

interface PasswordPolicyContext {
  cpf?: string | null;
  email?: string | null;
  currentPasswordHash?: string | null;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function generateTemporaryPassword() {
  return randomBytes(12).toString("base64url");
}

export async function hashPassword(password: string) {
  return hash(password, env.BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function assertPasswordPolicy(
  password: string,
  context: PasswordPolicyContext = {},
) {
  if (password.length < 10) {
    throw new AppError("A senha deve ter no mínimo 10 caracteres.", 400);
  }

  if (password.length > 72) {
    throw new AppError("A senha deve ter no máximo 72 caracteres.", 400);
  }

  if (context.cpf) {
    const normalizedCpf = normalizeCpf(context.cpf);
    const passwordAsCpf = normalizeCpf(password);

    if (normalizedCpf.length === 11 && passwordAsCpf === normalizedCpf) {
      throw new AppError("A nova senha não pode ser igual ao CPF.", 400);
    }
  }

  if (context.email && normalizeEmail(password) === normalizeEmail(context.email)) {
    throw new AppError("A nova senha não pode ser igual ao e-mail.", 400);
  }

  if (
    context.currentPasswordHash &&
    (await verifyPassword(password, context.currentPasswordHash))
  ) {
    throw new AppError(
      "A nova senha deve ser diferente da senha atual ou temporária.",
      400,
    );
  }
}
