import 'reflect-metadata';

import { config as loadDotenv } from 'dotenv';

import { ConfigError, loadConfig, type AppConfig } from './config/env';
import { createApp } from './create-app';

async function main(): Promise<void> {
  // server/.env in development; real environments set variables directly.
  loadDotenv({ quiet: true });
  let config: AppConfig;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
  const app = await createApp(config);
  await app.listen(config.port);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
