import nodemailer from "nodemailer";
import { env } from "../env.js";

interface PasswordResetMailInput {
  to: string;
  name: string;
  resetUrl: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createGmailTransporter() {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
  });
}

class MailService {
  async sendPasswordReset(input: PasswordResetMailInput) {
    const transporter = createGmailTransporter();
    const safeName = escapeHtml(input.name);
    const safeUrl = escapeHtml(input.resetUrl);

    const text = [
      `Olá, ${input.name}.`,
      "",
      "Recebemos uma solicitação para redefinir sua senha.",
      "Acesse o link abaixo para cadastrar uma nova senha:",
      input.resetUrl,
      "",
      "A nova senha deve ter entre 6 e 8 caracteres e usar somente letras e números.",
      "Este link expira em 30 minutos e pode ser utilizado apenas uma vez.",
      "Se você não solicitou a redefinição, ignore esta mensagem.",
    ].join("\n");

    const html = `
      <p>Olá, ${safeName}.</p>
      <p>Recebemos uma solicitação para redefinir sua senha.</p>
      <p><a href="${safeUrl}">Clique aqui para cadastrar uma nova senha</a>.</p>
      <p>A nova senha deve ter entre 6 e 8 caracteres e usar somente letras e números.</p>
      <p>Este link expira em 30 minutos e pode ser utilizado apenas uma vez.</p>
      <p>Se você não solicitou a redefinição, ignore esta mensagem.</p>
    `;

    if (!transporter) {
      if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
        throw new Error("Gmail SMTP não configurado");
      }

      console.info("PASSWORD_RESET_EMAIL_DEVELOPMENT");
      console.info(text);
      return;
    }

    await transporter.sendMail({
      from: env.MAIL_FROM ?? env.GMAIL_USER,
      to: input.to,
      subject: "Redefinição de senha — Provas Gestão Escolar",
      text,
      html,
    });
  }
}

export const mailService = new MailService();
