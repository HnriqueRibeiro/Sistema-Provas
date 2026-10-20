import { Router } from "express";
import multer from "multer";
import { ProvasController } from "../controllers/provas-controller.js";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.js";
import { verifyUserAuthorization } from "../middlewares/verify-user-authorization.js";
import uploadConfig from "../configs/upload.js";

const provasRoutes = Router();
const provasController = new ProvasController();
const upload = multer(uploadConfig.MULTER);

provasRoutes.use(ensureAuthenticated);

// === VISUALIZAÇÃO E DOWNLOAD (Coordenador e Professor) ===
provasRoutes.get(
  "/",
  verifyUserAuthorization(["COORDENADOR", "PROFESSOR"]),
  provasController.index,
);
provasRoutes.get(
  "/:id",
  verifyUserAuthorization(["COORDENADOR", "PROFESSOR"]),
  provasController.show,
);

// === GERENCIAMENTO (Upload e Deleção) ===
provasRoutes.post(
  "/",
  verifyUserAuthorization(["PROFESSOR"]), // Coordenador não sobe prova, só professor.
  upload.single("arquivo"),
  provasController.create,
);

// NOVA ROTA: Atualizar o Status (Apenas Coordenador)
provasRoutes.patch(
  "/:id/status",
  verifyUserAuthorization(["COORDENADOR"]),
  provasController.updateStatus,
);

// Professor e Coordenador podem deletar (Coordenador deleta qualquer uma, Professor só as dele)
provasRoutes.delete(
  "/:id",
  verifyUserAuthorization(["COORDENADOR", "PROFESSOR"]),
  provasController.delete,
);

export { provasRoutes };
