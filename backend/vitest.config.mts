import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "secreto-de-pruebas-secreto-de-pruebas-1234",
      CORS_ORIGIN: "http://localhost:4200",
    },
  },
});
