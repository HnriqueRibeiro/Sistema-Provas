import { Router } from "express";
import { UsersController } from "../controllers/users-controller.js";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.js";
import { verifyUserAuthorization } from "../middlewares/verify-user-authorization.js";

const usersRoutes = Router();
const usersController = new UsersController();

usersRoutes.post(
  "/",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.create,
);

usersRoutes.get(
  "/",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.index,
);

usersRoutes.get(
  "/professores",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.indexProfessores,
);

usersRoutes.get(
  "/:id",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.show,
);

usersRoutes.put(
  "/:id",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.update,
);

usersRoutes.patch(
  "/:id/status",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.updateStatus,
);

usersRoutes.delete(
  "/:id",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.delete,
);

export { usersRoutes };