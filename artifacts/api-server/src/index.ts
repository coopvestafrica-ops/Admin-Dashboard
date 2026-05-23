import app from "./app";
import { logger } from "./lib/logger";

// Unhandled rejection & uncaught exception handlers
process.on("unhandledRejection", (err) => {
  logger.fatal(err, "Unhandled rejection");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.fatal(err, "Uncaught exception");
  process.exit(1);
});

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
