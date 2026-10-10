import multer from "multer";
import { AppError } from "../utils/AppError.js";

const MAX_SIZE = 3; // 3 MB
const MAX_FILE_SIZE = 1024 * 1024 * MAX_SIZE;

const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

const MULTER = {
  // 1. Mudamos de diskStorage para memoryStorage (O arquivo fica na RAM)
  storage: multer.memoryStorage(),

  // 2. Mantemos o limite de tamanho (3MB)
  limits: {
    fileSize: MAX_FILE_SIZE,
  },

  // 3. Mantemos o filtro de segurança (Apenas imagens e documentos)
  fileFilter: (req: any, file: any, callback: any) => {
    if (ACCEPTED_FILE_TYPES.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new AppError(
          "Formato de arquivo não suportado. Envie Imagens, PDF ou Word.",
          400,
        ),
      );
    }
  },
};

export default {
  MULTER,
};
