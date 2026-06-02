import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createDatabase, initializeSqlRuntime } from "./db/client.js";

dotenv.config();

const port = Number(process.env.PORT ?? 8787);

await initializeSqlRuntime();
const db = createDatabase(process.env.DATABASE_PATH ?? "./api-tools.db");
const app = createApp({ db });

app.listen(port, () => {
  console.log(`API Tools server listening on http://127.0.0.1:${port}`);
});
