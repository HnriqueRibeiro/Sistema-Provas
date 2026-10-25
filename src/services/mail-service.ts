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

function safeSenderName(value: string) {
  return value
    .replace(/[\r\n<>]/g, "")
    .trim()
    .slice(0, 120);
}

function buildMessage(input: PasswordResetMailInput) {
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

  const html = [
    `<p>Olá, ${safeName}.</p>`,
    "<p>Recebemos uma solicitação para redefinir sua senha.</p>",
    `<p><a href=\"${safeUrl}\">Clique aqui para cadastrar uma nova senha</a>.</p>`,
    "<p>A nova senha deve ter entre 6 e 8 caracteres e usar somente letras e números.</p>",
    "<p>Este link expira em 30 minutos e pode ser utilizado apenas uma vez.</p>",
    "<p>Se você não solicitou a redefinição, ignore esta mensagem.</p>",
  ].join("");

  return { text, html };
}

class MailService {
  async sendPasswordReset(input: PasswordResetMailInput) {
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
        throw new Error("Resend não configurado");
      }

      console.info("PASSWORD_RESET_EMAIL_DEVELOPMENT");
      console.info(input.resetUrl);
      return;
    }

    const fromName = safeSenderName(
      env.RESEND_FROM_NAME || "Provas Gestão Escolar",
    );
    const { text, html } = buildMessage(input);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${env.RESEND_FROM_EMAIL}>`,
        to: [input.to],
        subject: "Redefinição de senha — Provas Gestão Escolar",
        text,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      console.error("Erro ao enviar e-mail pelo Resend:", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      });

      throw new Error(`Resend retornou status ${response.status}`);
    }
  }
}

export const mailService = new MailService();
