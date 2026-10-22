import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/httpError";
import { verifyAccessToken } from "../lib/tokens";

export interface AuthRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new HttpError(401, "No autorizado");
  req.userId = verifyAccessToken(header.slice(7));
  next();
}