import type { CookieOptions } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "./httpError";

export const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutos
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días
export const REFRESH_COOKIE = "rt";

const REFRESH_SECRET = `${env.JWT_SECRET}:refresh`;

export function signAccessToken(userId: number): string {
  return jwt.sign({ sub: String(userId), typ: "access" }, env.JWT_SECRET, {
    expiresIn: ACCESS_TTL_SECONDS,
  });
}

export function signRefreshToken(userId: number): string {
  return jwt.sign({ sub: String(userId), typ: "refresh" }, REFRESH_SECRET, {
    expiresIn: REFRESH_TTL_SECONDS,
  });
}

function readUserId(token: string, secret: string, typ: "access" | "refresh"): number {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    throw new HttpError(401, "Token inválido o caducado");
  }
  if (typeof payload === "string" || payload.typ !== typ) {
    throw new HttpError(401, "Token inválido");
  }
  const id = Number(payload.sub);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(401, "Token inválido");
  return id;
}

export const verifyAccessToken = (token: string) => readUserId(token, env.JWT_SECRET, "access");
export const verifyRefreshToken = (token: string) => readUserId(token, REFRESH_SECRET, "refresh");

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true, // JavaScript del navegador no puede leerla (protege frente a XSS)
    secure: env.COOKIE_SECURE ?? (env.NODE_ENV === "production" || env.COOKIE_SAMESITE === "none"),
    sameSite: env.COOKIE_SAMESITE,
    path: "/api/auth",
  };
}

export const refreshCookieOptions = (): CookieOptions => ({
  ...baseCookieOptions(),
  maxAge: REFRESH_TTL_SECONDS * 1000,
});

export const clearCookieOptions = (): CookieOptions => baseCookieOptions();