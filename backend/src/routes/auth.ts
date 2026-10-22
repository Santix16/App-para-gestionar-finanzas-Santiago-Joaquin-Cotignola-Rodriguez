import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createDefaultAccount, createDefaultCategories } from "../lib/defaults";
import { HttpError } from "../lib/httpError";
import {
  REFRESH_COOKIE,
  clearCookieOptions,
  refreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/tokens";
import { parseWith } from "../lib/validate";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { requireAllowedOrigin } from "../middleware/origin";
import { loginLimiter, registerLimiter } from "../middleware/rateLimit";

const router = Router();

const email = z
  .email("email no válido")
  .max(254)
  .transform((v) => v.toLowerCase());

const registerSchema = z.object({
  email,
  name: z.string().trim().min(1, "el nombre es obligatorio").max(100),
  password: z
    .string()
    .min(8, "mínimo 8 caracteres")
    .max(128, "máximo 128 caracteres")
    .regex(/[A-Za-z]/, "debe incluir al menos una letra")
    .regex(/\d/, "debe incluir al menos un número"),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, "la contraseña es obligatoria").max(128),
});

// Hash falso para que el tiempo de respuesta no revele si el email existe
const DUMMY_HASH = bcrypt.hashSync("contraseña-inexistente", 10);

const publicUser = (u: { id: number; name: string; currency: string; theme: string }) => ({
  id: u.id,
  name: u.name,
  currency: u.currency,
  theme: u.theme,
});

function startSession(
  res: import("express").Response,
  user: { id: number; name: string; currency: string; theme: string },
) {
  res.cookie(REFRESH_COOKIE, signRefreshToken(user.id), refreshCookieOptions());
  res.json({ token: signAccessToken(user.id), user: publicUser(user) });
}

router.post("/register", registerLimiter, async (req, res) => {
  const { email: mail, name, password } = parseWith(registerSchema, req.body);

  if (await prisma.user.findUnique({ where: { email: mail } }))
    throw new HttpError(409, "Email ya registrado");

  const user = await prisma.user.create({
    data: { email: mail, name, passwordHash: await bcrypt.hash(password, 10) },
  });
  await createDefaultCategories(user.id);
  await createDefaultAccount(user.id);
  res.status(201).json({ id: user.id, email: user.email, name: user.name });
});

router.post("/login", loginLimiter, async (req, res) => {
  const { email: mail, password } = parseWith(loginSchema, req.body);

  const user = await prisma.user.findUnique({ where: { email: mail } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, "Credenciales incorrectas");

  startSession(res, user);
});

// Renueva el access token usando la cookie httpOnly (y rota la cookie)
router.post("/refresh", requireAllowedOrigin, async (req, res) => {
  const raw: unknown = req.cookies?.[REFRESH_COOKIE];
  if (typeof raw !== "string" || !raw) throw new HttpError(401, "Sesión no iniciada");

  let userId: number;
  try {
    userId = verifyRefreshToken(raw);
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, clearCookieOptions());
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.clearCookie(REFRESH_COOKIE, clearCookieOptions());
    throw new HttpError(401, "Sesión no válida");
  }
  startSession(res, user);
});

router.post("/logout", requireAllowedOrigin, (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, clearCookieOptions());
  res.status(204).send();
});

const themeSchema = z.object({ theme: z.enum(["light", "dark"]) });

router.patch("/theme", requireAuth, async (req: AuthRequest, res) => {
  const { theme } = parseWith(themeSchema, req.body);
  await prisma.user.update({ where: { id: req.userId }, data: { theme } });
  res.json({ theme });
});

export default router;