import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createDatabase, initializeSqlRuntime, type AppDatabase } from "./db/client.js";

dotenv.config();

interface ShutdownDependencies {
  server: {
    close(callback?: (error?: Error) => void): unknown;
  };
  db: Pick<AppDatabase, "close">;
  exit?: (code?: number) => never;
}

export function createShutdownHandler(dependencies: ShutdownDependencies) {
  let closed = false;

  return async (_signal: NodeJS.Signals) => {
    if (closed) return;
    closed = true;

    await new Promise<void>((resolve, reject) => {
      dependencies.server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    dependencies.db.close();

    if (dependencies.exit) {
      dependencies.exit(0);
    } else {
      process.exitCode = 0;
    }
  };
}

export async function startServer(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT ?? 8787);

  await initializeSqlRuntime();
  const db = createDatabase(env.DATABASE_PATH ?? "./api-tools.db");
  const app = createApp({ db });
  const server = app.listen(port, () => {
    const address = server.address() as AddressInfo | null;
    const actualPort = address?.port ?? port;
    console.log(`API Tools server listening on http://127.0.0.1:${actualPort}`);
  });
  const shutdown = createShutdownHandler({ server, db });

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return { app, db, server, shutdown };
}

if (process.env.NODE_ENV !== "test") {
  await startServer();
}
