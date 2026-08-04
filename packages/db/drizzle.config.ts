import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit 配置。
 * DATABASE_URL 仅用于 generate/migrate CLI；运行时连接见 src/client.ts。
 */
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://strict_rag:strict_rag@127.0.0.1:5432/strict_rag';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
  schemaFilter: ['public'],
});
