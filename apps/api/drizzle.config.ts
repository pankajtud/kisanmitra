import type { Config } from 'drizzle-kit';

export default {
  schema: '../../packages/shared/src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/kisanmitra',
  },
  strict: true,
} satisfies Config;
