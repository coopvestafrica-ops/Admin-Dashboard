import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

// ── Fix #1: CORS – fail fast if ALLOWED_ORIGIN is unset in production ─────────
if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGIN) {
  logger.fatal(
    "ALLOWED_ORIGIN environment variable is not set. " +
    "Refusing to start in production with a wildcard CORS origin. " +
    "Set ALLOWED_ORIGIN to your frontend URL (e.g. https://app.coopvest.africa).",
  );
  process.exit(1);
}

const app: Express = express();

// Security headers
app.use(helmet());

// CORS — restrict to allowed origin in production
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN ?? "*",
    credentials: true,
  }),
);

// Rate limiting — 200 requests per 15 minutes per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  }),
);

// Request logging (redacts auth headers)
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", router);

// Global Express error handler
app.use((err: any, req: any, res: any, next: any) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
