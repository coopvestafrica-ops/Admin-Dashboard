import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import multer from "multer";
import path from "path";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

// CORS configuration
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

const app: Express = express();

// Serve static frontend files from coopvest-dashboard
// In Vercel serverless, use cwd which points to the deployment root
const frontendDistPath = path.resolve(process.cwd(), "coopvest-dashboard/dist/public");
app.use(express.static(frontendDistPath));

// Security headers
app.use(helmet());

// CORS — use allowed origin
app.use(
  cors({
    origin: allowedOrigin,
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

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ limit: "100kb", extended: true }));

// File upload middleware - use memory storage for Supabase upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Make upload middleware available to routes
app.set('upload', upload);

app.use("/api", router);
// Also mount at /api/admin for frontend compatibility - FIX for members page
app.use("/api/admin", router);

// Global Express error handler
app.use((err: any, req: any, res: any, next: any) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

// Catch-all 404 handler
app.use((req, res) => {
  logger.info({ path: req.path }, "Unhandled route");
  // Serve index.html for SPA routing (but not for API routes)
  if (!req.path.startsWith('/api')) {
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  }
  res.status(404).json({ success: false, error: "Endpoint not found", path: req.path });
});

export default app;
