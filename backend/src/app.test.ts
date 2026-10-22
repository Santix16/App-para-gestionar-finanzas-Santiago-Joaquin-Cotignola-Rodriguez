import bcrypt from "bcrypt";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    account: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    category: { findMany: vi.fn(), createMany: vi.fn(), findFirst: vi.fn() },
    transaction: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  },
}));
vi.mock("./lib/prisma", () => ({ prisma: prismaMock }));

import { app } from "./app";
import { signAccessToken, signRefreshToken } from "./lib/tokens";

const bearer = () => ({ Authorization: `Bearer ${signAccessToken(1)}` });
const user = {
  id: 1,
  email: "ana@example.com",
  name: "Ana",
  currency: "EUR",
  theme: "light",
  passwordHash: bcrypt.hashSync("clave1234", 4),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("seguridad básica", () => {
  it("health responde y no revela Express, con cabeceras de helmet", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("rutas desconocidas devuelven 404 en JSON", async () => {
    const res = await request(app).get("/api/no-existe");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("las rutas privadas exigen token", async () => {
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("No autorizado");
  });

  it("un refresh token no sirve como access token", async () => {
    const res = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${signRefreshToken(1)}`);
    expect(res.status).toBe(401);
  });

  it("un token manipulado se rechaza", async () => {
    const res = await request(app).get("/api/accounts").set("Authorization", "Bearer abc.def.ghi");
    expect(res.status).toBe(401);
  });

  it("JSON mal formado devuelve 400 limpio", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{esto no es json");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("JSON no válido");
  });
});

describe("validación de entrada", () => {
  it("un :id no numérico devuelve 400 en vez de llegar a Prisma", async () => {
    const res = await request(app).delete("/api/accounts/abc").set(bearer());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Identificador no válido");
    expect(prismaMock.account.deleteMany).not.toHaveBeenCalled();
  });

  it("rechaza contraseñas débiles en el registro", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "a@a.com", name: "A", password: "solo-letras" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("número");
  });

  it("rechaza importes negativos o cero en movimientos", async () => {
    const res = await request(app)
      .post("/api/transactions")
      .set(bearer())
      .send({ accountId: 1, categoryId: 1, amount: -5, type: "EXPENSE", date: "2026-10-01" });
    expect(res.status).toBe(400);
  });

  it("limita el tamaño de página", async () => {
    const res = await request(app).get("/api/transactions?pageSize=1000").set(bearer());
    expect(res.status).toBe(400);
  });
});

describe("autenticación y sesión", () => {
  it("registro correcto crea usuario, categorías y cuenta", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 5, email: "ana@example.com", name: "Ana" });
    prismaMock.category.findMany.mockResolvedValue([]);
    prismaMock.account.count.mockResolvedValue(0);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "Ana@Example.com", name: "Ana", password: "clave1234" });

    expect(res.status).toBe(201);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: "ana@example.com" } });
    expect(prismaMock.category.createMany).toHaveBeenCalled();
    expect(prismaMock.account.create).toHaveBeenCalled();
  });

  it("registro con email repetido devuelve 409", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 1 });
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "ana@example.com", name: "Ana", password: "clave1234" });
    expect(res.status).toBe(409);
  });

  it("login correcto devuelve access token y cookie httpOnly de refresh", async () => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ana@example.com", password: "clave1234" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toEqual({ id: 1, name: "Ana", currency: "EUR", theme: "light" });
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain("rt=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/api/auth");
  });

  it("login con usuario inexistente y con clave errónea dan el mismo error", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const a = await request(app).post("/api/auth/login").send({ email: "x@x.com", password: "whatever1" });
    prismaMock.user.findUnique.mockResolvedValueOnce(user);
    const b = await request(app).post("/api/auth/login").send({ email: "ana@example.com", password: "mala-clave1" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  it("refresh con cookie válida devuelve un token nuevo", async () => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `rt=${signRefreshToken(1)}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(String(res.headers["set-cookie"])).toContain("rt=");
  });

  it("refresh sin cookie devuelve 401", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("refresh con un access token en la cookie devuelve 401", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `rt=${signAccessToken(1)}`);
    expect(res.status).toBe(401);
  });

  it("refresh desde un origen no permitido devuelve 403 (defensa CSRF)", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", "https://sitio-malicioso.example")
      .set("Cookie", `rt=${signRefreshToken(1)}`);
    expect(res.status).toBe(403);
  });

  it("logout borra la cookie", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(204);
    expect(String(res.headers["set-cookie"])).toMatch(/rt=;/);
  });
});

describe("movimientos paginados", () => {
  it("devuelve página, total y totales de todo el filtro", async () => {
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.transaction.count.mockResolvedValue(45);
    prismaMock.transaction.groupBy.mockResolvedValue([
      { type: "INCOME", _sum: { amount: "100.10" } },
      { type: "EXPENSE", _sum: { amount: "40.2" } },
    ]);

    const res = await request(app).get("/api/transactions?month=2026-10&page=2&pageSize=10").set(bearer());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      items: [],
      total: 45,
      page: 2,
      pageSize: 10,
      totals: { income: 100.1, expense: 40.2 },
    });
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });
});

describe("límite de intentos de login", () => {
  it("bloquea con 429 tras demasiados intentos fallidos", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const statuses: number[] = [];
    for (let i = 0; i < 14; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "intruso@example.com", password: "adivinando1" });
      statuses.push(res.status);
    }
    expect(statuses).toContain(401);
    expect(statuses[statuses.length - 1]).toBe(429);
  });
});