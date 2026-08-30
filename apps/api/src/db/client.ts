import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@kisanmitra/shared/schema';
import { env } from '../env.js';

/** A single long-lived process; no serverless (CLAUDE.md §4). One pool. */
export const sql = postgres(env.databaseUrl, { max: 10 });
export const db = drizzle(sql, { schema });

export type Db = typeof db;
export { schema };
