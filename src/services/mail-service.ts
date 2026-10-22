import { env } from "../env.js";

interface PasswordResetMailInput {
  to: string;
  name: string;
  resetUrl: string;
}

interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

class DevelopmentMailProvider implements MailProvider {
  async send(message: MailMessage) {
    if (env.NODE_ENV !== "development") {
      throw new Error("Development mail provider is disabled outside development");
    }

    console.info("PASSWORD_RESET_EMAIL_DEVELOPMENT");
    console.info(message.text);
  }
}

class HttpMailProvider implements MailProvider {
  async send(message: MailMessage) {
    if (!env.MAIL_PROVIDER_URL) {
      throw new Error("MAIL_PROVIDER_URL is not configured");
    }

    const response = await fetch(env.MAIL_PROVIDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.MAIL_PROVIDER_API_KEY
          ? { Authorization: `Bearer ${env.MAIL_PROVIDER_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Mail provider returned status ${response.status}`);
    }
  }
}

function getMailProvider(): MailProvider {
  if (env.MAIL_PROVIDER_URL) return new HttpMailProvider();
  return new DevelopmentMailProvider();
}

class MailService {
  async sendPasswordReset(input: PasswordResetMailInput) {
    const from = env.MAIL_FROM ?? "no-reply@provas.local";
    const safeName = escapeHtml(input.name);
    const safeUrl = escapeHtml(input.resetUrl);

    const message: MailMessage = {
      from,
      to: input.to,
      subject: "Redefinição de senha — Provas Gestão Escolar",
      text: [
        `Olá, ${input.name}.`,
        "",
        "Recebemos uma solicitação para redefinir sua senha.",
        "Acesse o link abaixo para cadastrar uma nova senha:",
        input.resetUrl,
        "",
        "Este link expira em 30 minutos e pode ser utilizado apenas uma vez.",
        "Se você não solicitou a redefinição, ignore esta mensagem.",
      ].join("\n"),
      html: `
        <p>Olá, ${safeName}.</p>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p><a href="${safeUrl}">Clique aqui para cadastrar uma nova senha</a>.</p>
        <p>Este link expira em 30 minutos e pode ser utilizado apenas uma vez.</p>
        <p>Se você não solicitou a redefinição, ignore esta mensagem.</p>
      `,
    };

    await getMailProvider().send(message);
  }
}

export const mailService = new MailService();
