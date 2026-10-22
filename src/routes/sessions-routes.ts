import { Router } from "express";
import { SessionsController } from "../controllers/sessions-controller.js";
import {
  createRateLimit,
  fingerprintRateLimitValue,
} from "../middlewares/rate-limit.js";

const sessionsRoutes = Router();
const sessionsController = new SessionsController();

const loginRateLimit = createRateLimit({
  namespace: "login",
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: (req) =>
    `${req.ip || "unknown"}:${fingerprintRateLimitValue(
      String(req.body?.email ?? "").trim().toLowerCase(),
    )}`,
});

sessionsRoutes.post("/", loginRateLimit, sessionsController.create);

export { sessionsRoutes };
