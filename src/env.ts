import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email().optional(),
);
const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().url().optional(),
);
const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),
  PASSWORD_CHANGE_TOKEN_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().url().default("http://localhost:3333"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  MAIL_FROM: optionalEmail,
  MAIL_PROVIDER_URL: optionalUrl,
  MAIL_PROVIDER_API_KEY: optionalString,
});

export const env = envSchema.parse(process.env);
