import { Router } from "express";

import { usersRoutes } from "../routes/users-routes.js";
import { escolasRoutes } from "../routes/escolas-routes.js";
import { turmasRoutes } from "./turmas-routes.js";
import { sessionsRoutes } from "../routes/sessions-routes.js";
import { provasRoutes } from "./provas-routes.js";
import { authRoutes } from "./auth-routes.js";

const routes = Router();

routes.use("/users", usersRoutes);
routes.use("/escolas", escolasRoutes);
routes.use("/turmas", turmasRoutes);
routes.use("/provas", provasRoutes);
routes.use("/sessions", sessionsRoutes);
routes.use("/auth", authRoutes);

export { routes };
