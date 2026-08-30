import Fastify from 'fastify';
import { env } from './env.js';
import { sql } from './db/client.js';

const app = Fastify({
  logger: { level: env.isProduction ? 'info' : 'debug' },
});

/**
 * M0 has no auth and no sync endpoints — the web client is fully offline until
 * M2 (CLAUDE.md §13). This server exists so the schema, migrations and seed
 * have somewhere to live and so the deployment target is real.
 */
app.get('/health', async () => {
  await sql`select 1`;
  return { ok: true };
});

const close = async () => {
  await app.close();
  await sql.end();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);

await app.listen({ port: env.port, host: env.host });
