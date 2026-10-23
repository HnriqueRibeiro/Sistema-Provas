import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

const SIGNED_READ_URL_EXPIRES_IN_SECONDS = 5 * 60;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

function requireR2Config() {
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET_NAME
  ) {
    throw new Error("Cloudflare R2 não está configurado.");
  }

  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucketName: env.R2_BUCKET_NAME,
  };
}

let client: S3Client | null = null;

function getClient() {
  if (client) return client;

  const config = requireR2Config();
  client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return client;
}

function safeOriginalFileName(value: string) {
  const withoutControls = value.replace(/[\u0000-\u001F\u007F\r\n"]/g, "").trim();
  return (withoutControls || "arquivo").slice(0, 255);
}

class ObjectStorageService {
  buildProofKey(escolaId: string, contentType: string) {
    const extension = EXTENSION_BY_MIME[contentType];

    if (!extension) {
      throw new Error("Tipo de arquivo não suportado pelo armazenamento.");
    }

    return `escolas/${escolaId}/provas/${randomUUID()}${extension}`;
  }

  normalizeOriginalFileName(fileName: string) {
    return safeOriginalFileName(fileName);
  }

  async upload(input: {
    key: string;
    body: Buffer;
    contentType: string;
    originalFileName: string;
  }) {
    const config = requireR2Config();
    const originalFileName = safeOriginalFileName(input.originalFileName);

    await getClient().send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.body.length,
        ContentDisposition: `inline; filename="${originalFileName}"`,
        Metadata: {
          "original-file-name": Buffer.from(originalFileName, "utf8").toString(
            "base64url",
          ),
        },
      }),
    );
  }

  async delete(key: string) {
    const config = requireR2Config();

    await getClient().send(
      new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      }),
    );
  }

  async createSignedReadUrl(key: string) {
    const config = requireR2Config();

    return getSignedUrl(
      getClient(),
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      }),
      { expiresIn: SIGNED_READ_URL_EXPIRES_IN_SECONDS },
    );
  }
}

export const objectStorageService = new ObjectStorageService();
