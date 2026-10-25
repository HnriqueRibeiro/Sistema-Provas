import { createHash, randomBytes } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { authConfig } from "../configs/auth.js";
import { prisma } from "../database/prisma.js";
import { env } from "../env.js";
import { clearLoginFailures } from "../services/login-attempt-service.js";
import { mailService } from "../services/mail-service.js";
import {
  assertPasswordPolicy,
  hashPassword,
  normalizeEmail,
} from "../services/password-service.js";
import { AppError } from "../utils/AppError.js";

const FORGOT_PASSWORD_MESSAGE =
  "Se existir uma conta vinculada a este e-mail, enviaremos as instruções para redefinir sua senha.";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "E-mail inválido" })
    .transform((value) => normalizeEmail(value)),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32, { message: "Token inválido" }),
  newPassword: z
    .string()
    .min(6, { message: "A senha deve ter no mínimo 6 caracteres." })
    .max(8, { message: "A senha deve ter no máximo 8 caracteres." })
    .regex(/^[A-Za-z0-9]+$/, {
      message: "A senha pode conter apenas letras e números.",
    }),
});

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

class AuthController {
  async forgotPassword(req: Request, res: Response) {
    const startedAt = Date.now();
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, ativo: true },
    });

    if (user?.ativo) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashResetToken(rawToken);
      const now = new Date();
      const expiresAt = addMinutes(
        now,
        authConfig.passwordResetTokenExpiresInMinutes,
      );

      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: now },
        }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        }),
      ]);

      const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/redefinir-senha?token=${encodeURIComponent(rawToken)}`;

      try {
        await mailService.sendPasswordReset({
          to: user.email,
          name: user.name,
          resetUrl,
        });
        console.info("PASSWORD_RESET_REQUESTED");
      } catch {
        console.error("PASSWORD_RESET_EMAIL_FAILED");
      }
    } else {
      hashResetToken(randomBytes(32).toString("hex"));
    }

    const elapsed = Date.now() - startedAt;
    const minimumResponseTimeMs = 250;
    if (elapsed < minimumResponseTimeMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, minimumResponseTimeMs - elapsed),
      );
    }

    return res.status(202).json({ message: FORGOT_PASSWORD_MESSAGE });
  }

  async resetPassword(req: Request, res: Response) {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const tokenHash = hashResetToken(token);
    const now = new Date();

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !resetToken ||
      resetToken.usedAt !== null ||
      resetToken.expiresAt <= now ||
      !resetToken.user.ativo
    ) {
      throw new AppError("Token de recuperação inválido ou expirado.", 401);
    }

    await assertPasswordPolicy(newPassword, {
      cpf: resetToken.user.cpf,
      email: resetToken.user.email,
      currentPasswordHash: resetToken.user.password,
    });

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      const claimedToken = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimedToken.count !== 1) {
        throw new AppError("Token de recuperação inválido ou já utilizado.", 401);
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          password: passwordHash,
          passwordChangedAt: now,
          tokenVersion: { increment: 1 },
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
        },
        data: { usedAt: now },
      });
    });

    clearLoginFailures(resetToken.user.email, req.ip || "unknown");
    console.info("PASSWORD_RESET_COMPLETED");

    return res.json({
      message: "Sua senha foi redefinida com sucesso. Faça login novamente.",
    });
  }
}

export { AuthController, FORGOT_PASSWORD_MESSAGE };