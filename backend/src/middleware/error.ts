import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../lib/httpError";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
};

interface MaybeCoded {
  code?: unknown;
  type?: unknown;
}

/** Manejador global: cualquier fallo devuelve JSON limpio y nunca filtra detalles internos. */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  const e = (err ?? {}) as MaybeCoded;

  // Errores del parser de body de Express
  if (e.type === "entity.parse.failed") return res.status(400).json({ error: "JSON no válido" });
  if (e.type === "entity.too.large") return res.status(413).json({ error: "Petición demasiado grande" });

  // Errores conocidos de Prisma
  switch (e.code) {
    case "P2002":
      return res.status(409).json({ error: "Ya existe un registro con esos datos" });
    case "P2025":
      return res.status(404).json({ error: "Registro no encontrado" });
    case "P2003":
      return res.status(409).json({ error: "No se puede completar: hay datos relacionados" });
    default:
      break;
  }

  console.error("Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
};