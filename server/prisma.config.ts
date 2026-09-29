import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 reads its settings from here, not from the environment on its own:
 * `.env` is loaded explicitly. Migrations are the only way the schema changes.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] },
});
