import app from "./app.js";
import { logger } from "./lib/logger.js";

// Vercel types - inline since @vercel/node types may not be available
interface VercelRequest {
  headers: { [key: string]: string | string[] | undefined };
  method?: string;
  body?: unknown;
  query?: { [key: string]: string };
  url?: string;
  path?: string;
}

interface VercelResponse {
  statusCode?: number;
  setHeader(key: string, value: string): VercelResponse;
  json(obj: unknown): VercelResponse;
  send(data: unknown): VercelResponse;
  end(): VercelResponse;
}

// Unhandled rejection & uncaught exception handlers
process.on("unhandledRejection", (err) => {
  logger.fatal(err, "Unhandled rejection");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.fatal(err, "Uncaught exception");
  process.exit(1);
});

// Vercel serverless handler
export default function handler(req: VercelRequest, res: VercelResponse) {
  app(req, res);
}

// Standalone server (used when running locally or on traditional hosting)
if (process.env.VERCEL === undefined) {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}
