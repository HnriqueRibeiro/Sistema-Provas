import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email().optional(),
);
const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().optional(),
);
const optionalGmailAppPassword = z.preprocess(
  (value) => {
    const normalized = emptyToUndefined(value);
    return typeof normalized === "string"
      ? normalized.replace(/\s/g, "")
      : normalized;
  },
  z.string().min(16).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(1),
    FRONTEND_URL: z.string().url().default("http://localhost:3333"),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    MAIL_FROM: optionalEmail,
    GMAIL_USER: optionalEmail,
    GMAIL_APP_PASSWORD: optionalGmailAppPassword,
    SUPABASE_URL: optionalString,
    SUPABASE_ANON_KEY: optionalString,
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.GMAIL_USER) {
        ctx.addIssue({
          code: "custom",
          path: ["GMAIL_USER"],
          message: "GMAIL_USER é obrigatório em produção.",
        });
      }

      if (!data.GMAIL_APP_PASSWORD) {
        ctx.addIssue({
          code: "custom",
          path: ["GMAIL_APP_PASSWORD"],
          message: "GMAIL_APP_PASSWORD é obrigatório em produção.",
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
