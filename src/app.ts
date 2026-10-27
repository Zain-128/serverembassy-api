import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import authRoutes from "./routes/auth.routes.js";
import storeRoutes from "./routes/store.routes.js";
import checkoutRoutes from "./routes/checkout.routes.js";
import adminRoutes from "./routes/admin.routes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isAllowed =
          env.corsOrigins.includes("*") ||
          env.corsOrigins.some((allowed) => allowed === origin || allowed === origin.replace(/\/$/, "")) ||
          origin.endsWith("powerlinedevices.com") ||
          origin.endsWith(".vercel.app") ||
          origin.includes("localhost") ||
          origin.includes("127.0.0.1");

        if (isAllowed) {
          return callback(null, true);
        }
        return callback(new AppError(403, "Origin not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: env.isDev ? 1000 : 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "serverembassy-api" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/store", storeRoutes);
  app.use("/api", checkoutRoutes);
  app.use("/api/admin", adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
