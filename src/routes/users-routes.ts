import { Router } from "express";
import { UsersController } from "../controllers/users-controller.js";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.js";
import { verifyUserAuthorization } from "../middlewares/verify-user-authorization.js";
import { createRateLimit } from "../middlewares/rate-limit.js";

const usersRoutes = Router();
const usersController = new UsersController();

const passwordChangeRateLimit = createRateLimit({
  namespace: "authenticated-password-change",
  windowMs: 15 * 60 * 1000,
  max: 8,
});

usersRoutes.post(
  "/",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.create,
);

usersRoutes.patch(
  "/me/password",
  ensureAuthenticated,
  passwordChangeRateLimit,
  usersController.changePassword,
);

usersRoutes.get(
  "/professores",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.index,
);

usersRoutes.post(
  "/:id/reset-access",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.resetAccess,
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

usersRoutes.delete(
  "/:id",
  ensureAuthenticated,
  verifyUserAuthorization(["COORDENADOR"]),
  usersController.delete,
);

export { usersRoutes };
