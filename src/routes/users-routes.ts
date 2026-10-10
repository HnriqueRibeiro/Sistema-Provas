import { Router } from "express";
import { UsersController } from "../controllers/users-controller.js";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.js";
import { verifyUserAuthorization } from "../middlewares/verify-user-authorization.js";

const usersRoutes = Router();
const usersController = new UsersController();

// Criação de usuário (como já tínhamos)
usersRoutes.post("/", usersController.create);

// NOVA ROTA: Listar professores (Apenas o coordenador logado pode ver)
usersRoutes.get(
  "/professores",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.index,
);

export { usersRoutes };
