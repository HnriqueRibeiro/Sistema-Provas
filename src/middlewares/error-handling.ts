import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../env.js";
import { AppError } from "../utils/AppError.js";

export const errorHandling: ErrorRequestHandler = (error, req, res, next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      message: "validation error",
      issues: error.format(),
    });
    return;
  }

  if (env.NODE_ENV !== "production") {
    console.error(error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Erro interno do servidor.",
    });
    return;
  }

  console.error("UNHANDLED_SERVER_ERROR", {
    method: req.method,
    path: req.path,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });

  res.status(500).json({ message: "Erro interno do servidor." });
};
