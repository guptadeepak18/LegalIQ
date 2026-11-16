import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.CLERK_PUBLISHABLE_KEY || process.env.CLERK_SECRET_KEY) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
}

// Mount API routes
app.use("/api", router);

// Locate frontend static assets
const candidateStaticDirs = [
  path.resolve(__dirname, "../../legaliq-web/dist/public"),
  path.resolve(__dirname, "../legaliq-web/dist/public"),
  path.resolve(process.cwd(), "artifacts/legaliq-web/dist/public"),
  path.resolve(process.cwd(), "dist/public"),
];
const staticDir = candidateStaticDirs.find((dir) => fs.existsSync(dir));

if (staticDir) {
  logger.info({ staticDir }, "Serving static web assets");
  app.use(express.static(staticDir));
  app.get("*", (req: Request, res: Response) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ success: false, message: "Not found" });
      return;
    }
    res.sendFile(path.join(staticDir, "index.html"));
  });
} else {
  // 404 handler for API-only requests
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: "Not found" });
  });
}

// Global JSON error handler — ensures errors always return JSON, never HTML
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ success: false, message: err.message ?? "Internal server error" });
});

export default app;
