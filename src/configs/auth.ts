import { env } from "../env.js";

export const authConfig = {
  jwt: {
    // Usamos 'as string' para o TypeScript parar de reclamar que pode ser undefined
    secret: env.JWT_SECRET as string,
    expiresIn: "1d",
  },
};
