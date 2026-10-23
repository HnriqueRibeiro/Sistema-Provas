import { env } from "../env.js";

interface PasswordResetMailInput {
  to: string;
  name: string;
  resetUrl: string;
}

interface OAuthTokenResponse {
  access_token?: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

async function getGmailAccessToken() {
  if (
    !env.GMAIL_CLIENT_ID ||
    !env.GMAIL_CLIENT_SECRET ||
    !env.GMAIL_REFRESH_TOKEN
  ) {
    return null;
  }

  const body = new URLSearchParams({
    client_id: env.GMAIL_CLIENT_ID,
    client_secret: env.GMAIL_CLIENT_SECRET,
    refresh_token: env.GMAIL_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google OAuth retornou status ${response.status}`);
  }

  const data = (await response.json()) as OAuthTokenResponse;

  if (!data.access_token) {
    throw new Error("Google OAuth não retornou access_token");
  }

  return data.access_token;
}

function buildRawEmail(input: PasswordResetMailInput) {
  if (!env.GMAIL_USER) {
    throw new Error("GMAIL_USER não configurado");
  }

  const safeName = escapeHtml(input.name);
  const safeUrl = escapeHtml(input.resetUrl);
  const subject = "Redefinição de senha — Provas Gestão Escolar";
  const boundary = `provas-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
    `<p><a href="${safeUrl}">Clique aqui para cadastrar uma nova senha</a>.</p>`,
    "<p>A nova senha deve ter entre 6 e 8 caracteres e usar somente letras e números.</p>",
    "<p>Este link expira em 30 minutos e pode ser utilizado apenas uma vez.</p>",
    "<p>Se você não solicitou a redefinição, ignore esta mensagem.</p>",
  ].join("");

  const rawMessage = [
    `From: ${env.GMAIL_USER}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text, "utf8").toString("base64"),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf8").toString("base64"),
    `--${boundary}--`,
  ].join("\r\n");

  return encodeBase64Url(rawMessage);
}

class MailService {
  async sendPasswordReset(input: PasswordResetMailInput) {
    const accessToken = await getGmailAccessToken();

    if (!accessToken || !env.GMAIL_USER) {
      if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
        throw new Error("Gmail API não configurada");
      }

      console.info("PASSWORD_RESET_EMAIL_DEVELOPMENT");
      console.info(input.resetUrl);
      return;
    }

    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: buildRawEmail(input),
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gmail API retornou status ${response.status}`);
    }
  }
}

export const mailService = new MailService();
