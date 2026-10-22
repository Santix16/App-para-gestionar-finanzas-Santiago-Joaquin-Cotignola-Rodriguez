import { rateLimit } from "express-rate-limit";

const tooMany = (message: string) => ({ error: message });

/** Límite general para toda la API. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany("Demasiadas peticiones. Inténtalo de nuevo en unos minutos."),
});

/** Login: solo cuentan los intentos fallidos (los correctos no gastan cupo). */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany("Demasiados intentos de inicio de sesión. Inténtalo de nuevo en 15 minutos."),
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany("Demasiados registros desde esta dirección. Inténtalo más tarde."),
});