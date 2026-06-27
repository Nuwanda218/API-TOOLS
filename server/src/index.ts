import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import { loadLocalEnv } from "./config/env.js";
import { createDatabase, initializeSqlRuntime, type AppDatabase } from "./db/client.js";

loadLocalEnv();

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
  const server = await new Promise<Server>((resolve, reject) => {
    const srv = app.listen(port, () => {
      const address = srv.address() as AddressInfo | null;
      const actualPort = address?.port ?? port;
      console.log(`API Tools server listening on http://127.0.0.1:${actualPort}`);
      resolve(srv);
    });
    srv.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Kill the other process or set a different PORT in .env`);
      }
      reject(err);
    });
  });
  const shutdown = createShutdownHandler({ server, db });

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return { app, db, server, shutdown };
}

if (process.env.NODE_ENV !== "test") {
  await startServer();
}
