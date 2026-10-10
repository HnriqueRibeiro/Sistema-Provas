import { Router } from "express";
import { TurmasController } from "../controllers/turmas-controller.js";
import { TurmaProfessoresController } from "../controllers/turma-professores-controller.js";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.js";
import { verifyUserAuthorization } from "../middlewares/verify-user-authorization.js";

const turmasRoutes = Router();
const turmasController = new TurmasController();
const turmaProfessoresController = new TurmaProfessoresController();

turmasRoutes.use(ensureAuthenticated);

// === VISUALIZAÇÃO (Liberado para Coordenador e Professor) ===
turmasRoutes.get(
  "/",
  verifyUserAuthorization(["COORDENADOR", "PROFESSOR"]),
  turmasController.index,
);
turmasRoutes.get(
  "/:id",
  verifyUserAuthorization(["COORDENADOR", "PROFESSOR"]),
  turmasController.show,
);

// === GERENCIAMENTO DE TURMAS (Apenas Coordenador) ===
turmasRoutes.post(
  "/",
  verifyUserAuthorization(["COORDENADOR"]),
  turmasController.create,
);
turmasRoutes.put(
  "/:id",
  verifyUserAuthorization(["COORDENADOR"]),
  turmasController.update,
);
turmasRoutes.delete(
  "/:id",
  verifyUserAuthorization(["COORDENADOR"]),
  turmasController.delete,
);

// === GERENCIAMENTO DE PROFESSORES NA TURMA (Apenas Coordenador) ===
turmasRoutes.post(
  "/:turmaId/professores",
  verifyUserAuthorization(["COORDENADOR"]),
  turmaProfessoresController.create,
);
turmasRoutes.delete(
  "/:turmaId/professores/:professorId",
  verifyUserAuthorization(["COORDENADOR"]),
  turmaProfessoresController.delete,
);

export { turmasRoutes };
