import { Router } from "express";
import { EscolasController } from "../controllers/escolas-controller.js";

const escolasRoutes = Router();
const escolasController = new EscolasController();

escolasRoutes.post("/", escolasController.create);
export { escolasRoutes };
