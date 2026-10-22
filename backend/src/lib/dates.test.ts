import { describe, expect, it } from "vitest";
import { addMonths, isMonth, monthRange } from "./dates";

describe("dates", () => {
  it("monthRange devuelve [inicio, inicio del mes siguiente)", () => {
    const { start, end } = monthRange("2026-12");
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("addMonths cruza años en ambos sentidos", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-10", 0)).toBe("2026-10");
  });

  it("isMonth valida el formato y el rango de mes", () => {
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-00")).toBe(false);
    expect(isMonth("26-10")).toBe(false);
    expect(isMonth(undefined)).toBe(false);
  });
});