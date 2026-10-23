import { compare, hash } from "bcrypt";
import { env } from "../env.js";
import { AppError } from "../utils/AppError.js";
import { normalizeCpf } from "../utils/cpf.js";

interface PasswordPolicyContext {
  cpf?: string | null;
  email?: string | null;
  currentPasswordHash?: string | null;
}

const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 8;
const ALPHANUMERIC_PASSWORD = /^[A-Za-z0-9]+$/;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
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
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(
      `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`,
      400,
    );
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new AppError(
      `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
      400,
    );
  }

  if (!ALPHANUMERIC_PASSWORD.test(password)) {
    throw new AppError("A senha pode conter apenas letras e números.", 400);
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
    throw new AppError("A nova senha deve ser diferente da senha atual.", 400);
  }
}

export const passwordPolicy = {
  minLength: PASSWORD_MIN_LENGTH,
  maxLength: PASSWORD_MAX_LENGTH,
};
