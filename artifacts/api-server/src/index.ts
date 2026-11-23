import app from "./app";
import { logger } from "./lib/logger";
import { startEmailScheduler } from "./services/emailScheduler";
import { ensureDatabaseSchema } from "./services/schemaBootstrap";
import { ensureRequiredEmailTemplates } from "./services/emailTemplates";
import { ensureDefaultBrochureTemplate } from "./services/brochureTemplates";
import { ensureBootstrapAdmin } from "./services/adminBootstrap";
import { runFreshStartResetIfRequested } from "./services/freshStartReset";

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

async function startServer() {
  try {
    // 1. Auto-initialize database schema if empty / uninitialized
    await ensureDatabaseSchema();

    // 2. Seed required baseline assets and bootstrap admin
    await ensureRequiredEmailTemplates();
    await ensureDefaultBrochureTemplate();
    await ensureBootstrapAdmin();
  } catch (err) {
    logger.error({ err }, "Database bootstrap error during server startup");
  }

  // When explicitly enabled for a publish, a failed backup/reset must stop
  // startup rather than serving stale production data.
  await runFreshStartResetIfRequested();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startEmailScheduler();
  });
}

void startServer();
