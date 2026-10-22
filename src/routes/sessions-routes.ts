import { Router } from "express";
import { SessionsController } from "../controllers/sessions-controller.js";
import { createRateLimit } from "../middlewares/rate-limit.js";

const sessionsRoutes = Router();
const sessionsController = new SessionsController();

// Proteção geral contra abuso por IP. As 3 tentativas incorretas por e-mail/IP
// são controladas no SessionsController e contam apenas credenciais inválidas.
const loginAbuseRateLimit = createRateLimit({
  namespace: "login-abuse-ip",
  windowMs: 15 * 60 * 1000,
  max: 30,
});

sessionsRoutes.post("/", loginAbuseRateLimit, sessionsController.create);

export { sessionsRoutes };
