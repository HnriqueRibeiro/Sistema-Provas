import { env } from "../env.js";

export const authConfig = {
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: "1d",
  },
  passwordChangeToken: {
    secret: env.PASSWORD_CHANGE_TOKEN_SECRET,
    expiresIn: "15m",
  },
  temporaryPasswordExpiresInHours: 72,
  passwordResetTokenExpiresInMinutes: 30,
};
