import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { corsOrigins, env } from "./config/env";
import { errorHandler, notFound } from "./middleware/error";
import { apiLimiter } from "./middleware/rateLimit";
import accountsRouter from "./routes/accounts";
import authRouter from "./routes/auth";
import budgetsRouter from "./routes/budgets";
import categoriesRouter from "./routes/categories";
import reportsRouter from "./routes/reports";
import statsRouter from "./routes/stats";
import transactionsRouter from "./routes/transactions";

export const app = express();

app.disable("x-powered-by");
if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", apiLimiter);
app.use("/api/auth", authRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/budgets", budgetsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/reports", reportsRouter);

app.use(notFound);
app.use(errorHandler);