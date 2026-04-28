import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.set("trust proxy", 1);

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

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Session with PostgreSQL store
const PgSession = ConnectPgSimple(session);
app.use(session({
  store: new PgSession({ pool, tableName: "user_sessions", createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "coopvest-session-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    sameSite: "lax",
  },
}));

// Rate limiting — strict on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", authLimiter);
app.use("/api", globalLimiter);
app.use("/api", router);

export default app;
