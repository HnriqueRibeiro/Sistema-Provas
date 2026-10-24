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
const portSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).max(65535).default(3000),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: portSchema,
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(1),
    FRONTEND_URL: z.string().url().default("http://localhost:3333"),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

    RESEND_API_KEY: optionalString,
    RESEND_FROM_EMAIL: optionalEmail,
    RESEND_FROM_NAME: optionalString,

    R2_ACCOUNT_ID: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    R2_BUCKET_NAME: optionalString,
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") return;

    const requiredFields = [
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
    ] as const;

    for (const field of requiredFields) {
      if (!data[field]) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${field} é obrigatório em produção.`,
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
