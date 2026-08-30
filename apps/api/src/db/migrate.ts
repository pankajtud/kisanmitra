import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { db, sql } from './client.js';

const folder = fileURLToPath(new URL('../../drizzle', import.meta.url));

await migrate(db, { migrationsFolder: folder });
console.log('migrations applied');
await sql.end();
