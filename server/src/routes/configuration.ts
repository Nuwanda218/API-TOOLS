import { Router } from "express";
import type { AppDatabase } from "../db/client.js";
import {
  buildConfigurationExport,
  importConfiguration,
  parseExportedConfiguration
} from "../configuration/configExport.js";

interface ConfigurationRouterDependencies {
  env?: NodeJS.ProcessEnv;
}

export function createConfigurationRouter(
  db: AppDatabase,
  dependencies: ConfigurationRouterDependencies = {}
) {
  const router = Router();
  const env = dependencies.env ?? process.env;

  router.get("/export", (_req, res) => {
    res.json(buildConfigurationExport(db, env));
  });

  router.post("/import", (req, res) => {
    const configuration = parseExportedConfiguration(req.body);
    res.json({ imported: importConfiguration(db, configuration) });
  });

  return router;
}
