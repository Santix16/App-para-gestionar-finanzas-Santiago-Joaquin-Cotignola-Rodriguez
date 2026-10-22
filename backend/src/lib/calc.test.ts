import { describe, expect, it } from "vitest";
import {
  average,
  budgetLevel,
  budgetPercent,
  daysElapsedIn,
  daysInMonthOf,
  projectExpense,
  round2,
  toNumber,
} from "./calc";

describe("round2 / toNumber", () => {
  it("redondea a 2 decimales sin errores de coma flotante", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.499)).toBe(2.5);
  });

  it("convierte Decimal/string/null a número", () => {
    expect(toNumber("12.50")).toBe(12.5);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("abc")).toBe(0);
  });
});

describe("calendario", () => {
  it("calcula los días de cada mes (incluye bisiestos)", () => {
    expect(daysInMonthOf("2026-10")).toBe(31);
    expect(daysInMonthOf("2026-02")).toBe(28);
    expect(daysInMonthOf("2028-02")).toBe(29);
    expect(daysInMonthOf("2026-04")).toBe(30);
  });

  it("días transcurridos: pasado completo, actual hasta hoy, futuro 0", () => {
    expect(daysElapsedIn("2026-09", "2026-10", 15)).toBe(30);
    expect(daysElapsedIn("2026-10", "2026-10", 15)).toBe(15);
    expect(daysElapsedIn("2026-11", "2026-10", 15)).toBe(0);
  });
});

describe("projectExpense", () => {
  it("extrapola linealmente el gasto a fin de mes", () => {
    expect(projectExpense(150, 10, 30)).toBe(450);
  });
  it("mes completado: devuelve lo gastado", () => {
    expect(projectExpense(321.5, 30, 30)).toBe(321.5);
  });
  it("sin días transcurridos: 0 (evita dividir entre cero)", () => {
    expect(projectExpense(100, 0, 30)).toBe(0);
  });
});

describe("presupuestos", () => {
  it("calcula el porcentaje consumido", () => {
    expect(budgetPercent(50, 200)).toBe(25);
    expect(budgetPercent(300, 200)).toBe(150);
    expect(budgetPercent(10, 0)).toBe(0);
  });

  it("clasifica el nivel de alerta (80 % y 100 %)", () => {
    expect(budgetLevel(0)).toBe("ok");
    expect(budgetLevel(79)).toBe("ok");
    expect(budgetLevel(80)).toBe("near");
    expect(budgetLevel(99)).toBe("near");
    expect(budgetLevel(100)).toBe("over");
    expect(budgetLevel(250)).toBe("over");
  });
});

describe("average", () => {
  it("media y lista vacía", () => {
    expect(average([10, 20, 30])).toBe(20);
    expect(average([])).toBe(0);
  });
});