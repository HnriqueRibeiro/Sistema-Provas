import { Router } from "express";

const escolasRoutes = Router();

// Sistema fechado: a criação inicial de escolas é um procedimento administrativo
// fora da API pública. Não exponha POST /escolas sem um papel de superadmin.

export { escolasRoutes };
