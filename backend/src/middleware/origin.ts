import type { NextFunction, Request, Response } from "express";
import { corsOrigins } from "../config/env";
import { HttpError } from "../lib/httpError";

/**
 * Defensa CSRF para los endpoints que usan la cookie de sesión (refresh y logout):
 * si la petición trae cabecera Origin, debe ser uno de los orígenes permitidos.
 */
export function requireAllowedOrigin(req: Request, _res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && !corsOrigins.includes(origin)) throw new HttpError(403, "Origen no permitido");
  next();
}