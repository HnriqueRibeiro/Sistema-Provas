import { Router } from "express";
import { AuthController } from "../controllers/auth-controller.js";
import {
  createRateLimit,
  fingerprintRateLimitValue,
} from "../middlewares/rate-limit.js";

const authRoutes = Router();
const authController = new AuthController();
const fifteenMinutes = 15 * 60 * 1000;

const forgotPasswordByIp = createRateLimit({
  namespace: "forgot-password-ip",
  windowMs: fifteenMinutes,
  max: 10,
});

const forgotPasswordByEmail = createRateLimit({
  namespace: "forgot-password-email",
  windowMs: fifteenMinutes,
  max: 5,
  keyGenerator: (req) =>
    fingerprintRateLimitValue(
      String(req.body?.email ?? "").trim().toLowerCase(),
    ),
});

const resetPasswordRateLimit = createRateLimit({
  namespace: "reset-password",
  windowMs: fifteenMinutes,
  max: 8,
  keyGenerator: (req) =>
    `${req.ip || "unknown"}:${fingerprintRateLimitValue(String(req.body?.token ?? ""))}`,
});

const firstAccessRateLimit = createRateLimit({
  namespace: "first-access",
  windowMs: fifteenMinutes,
  max: 8,
  keyGenerator: (req) =>
    `${req.ip || "unknown"}:${fingerprintRateLimitValue(String(req.body?.token ?? ""))}`,
});

authRoutes.post(
  "/forgot-password",
  forgotPasswordByIp,
  forgotPasswordByEmail,
  authController.forgotPassword,
);

authRoutes.post(
  "/reset-password",
  resetPasswordRateLimit,
  authController.resetPassword,
);

authRoutes.post(
  "/first-access/change-password",
  firstAccessRateLimit,
  authController.firstAccessChangePassword,
);

export { authRoutes };
