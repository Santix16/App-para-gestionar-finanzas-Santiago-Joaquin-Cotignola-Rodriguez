import { z } from "zod";
import { HttpError } from "./httpError";

/** Valida datos con un esquema Zod; si fallan, lanza un 400 con un mensaje legible. */
export function parseWith<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join(".");
    const message = first ? (path ? `${path}: ${first.message}` : first.message) : "Datos no válidos";
    throw new HttpError(400, message, z.flattenError(result.error));
  }
  return result.data;
}

const idSchema = z.coerce.number().int().positive().max(2147483647);

/** Convierte un parámetro de ruta en id válido o lanza 400 (evita NaN en Prisma). */
export function parseId(value: unknown): number {
  const result = idSchema.safeParse(value);
  if (!result.success) throw new HttpError(400, "Identificador no válido");
  return result.data;
}

export const MAX_MONEY = 9_999_999_999.99; // límite de Decimal(12,2)

export const moneyAmount = z
  .number()
  .finite()
  .min(-MAX_MONEY)
  .max(MAX_MONEY)
  .transform((v) => Math.round(v * 100) / 100);