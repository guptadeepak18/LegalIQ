import app from "./app";
import { logger } from "./lib/logger";
import { startEmailScheduler } from "./services/emailScheduler";
import { ensureRequiredEmailTemplates } from "./services/emailTemplates";
import { ensureDefaultBrochureTemplate } from "./services/brochureTemplates";
import { ensureBootstrapAdmin } from "./services/adminBootstrap";

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
    await ensureRequiredEmailTemplates();
    await ensureDefaultBrochureTemplate();
    await ensureBootstrapAdmin();
  } catch (err) {
    logger.warn({ err }, "Failed to ensure required email templates");
  }

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
