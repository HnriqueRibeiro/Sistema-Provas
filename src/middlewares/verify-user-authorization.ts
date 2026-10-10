import { AppError } from "../utils/AppError.js";
import { NextFunction, Request, Response } from "express";

//[""]posso passar um array com varios perfis, pode ser que uma rota esteja disponivel para manager, msd ns minhs splicação eu so tenho dois perfis, mas caso eu tenha outro perfil eu uso o array, sem o array iria passar apenas um perfil

function verifyUserAuthorization(role: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !role.includes(req.user.role)) {
      throw new AppError("Unauthorized", 401);
    }
    return next();
  };
}

export { verifyUserAuthorization };
