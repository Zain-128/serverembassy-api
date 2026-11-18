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
        const cleanOrigin = origin.replace(/\/$/, "").toLowerCase();

        // Exact trusted origins for Power Line Devices, Server Embassy, and configured admin sites
        const trustedOrigins = new Set([
          "https://powerlinedevices.com",
          "https://www.powerlinedevices.com",
          "https://serverembassy.com",
          "https://www.serverembassy.com",
          ...env.corsOrigins.map((o) => o.replace(/\/$/, "").toLowerCase()),
        ]);

        if (
          trustedOrigins.has(cleanOrigin) ||
          (cleanOrigin.endsWith(".vercel.app") &&
            (cleanOrigin.includes("server-embassy") || cleanOrigin.includes("powerline")))
        ) {
          return callback(null, true);
        }

        // Development-only exact port allowances (never substring)
        if (env.isDev) {
          const devOrigins = new Set([
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:5173",
          ]);
          if (devOrigins.has(cleanOrigin)) {
            return callback(null, true);
          }
        }

        return callback(new AppError(403, "Origin not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(
    express.json({
      limit: "2mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: env.isDev ? 1000 : 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "powerline-api" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/store", storeRoutes);
  app.use("/api", checkoutRoutes);
  app.use("/api/checkout", checkoutRoutes);
  app.use("/api/admin", adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
