import path from "node:path";
import type { Request } from "express";
import multer, { type FileFilterCallback } from "multer";
import { AppError } from "../utils/AppError.js";

const MAX_SIZE_MB = 10;
const MAX_FILE_SIZE = 1024 * 1024 * MAX_SIZE_MB;

const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
};

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
) {
  const allowedExtensions = ACCEPTED_FILE_TYPES[file.mimetype];
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions || !allowedExtensions.includes(extension)) {
    callback(
      new AppError(
        "Formato de arquivo não suportado. Envie JPG, PNG, PDF, DOC ou DOCX.",
        400,
      ),
    );
    return;
  }

  callback(null, true);
}

const MULTER = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10,
  },
  fileFilter,
};

export default {
  MULTER,
  MAX_FILE_SIZE,
  MAX_SIZE_MB,
};
