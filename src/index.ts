import { connectDb, disconnectDb } from "./lib/db.js";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

async function start() {
  await connectDb();
  app.listen(env.PORT, () => {
    console.log(`Power Line Devices API listening on http://localhost:${env.PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await disconnectDb();
  process.exit(0);
});
