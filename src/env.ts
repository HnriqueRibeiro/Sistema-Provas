import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),
  PASSWORD_CHANGE_TOKEN_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().url().default("http://localhost:3333"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  MAIL_FROM: z.string().email().optional(),
  MAIL_PROVIDER_URL: z.string().url().optional(),
  MAIL_PROVIDER_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
