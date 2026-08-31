import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { env } from './env.js';
import { sql } from './db/client.js';
import { joinHousehold, requestOtp, revokeSession, sessionFor, verifyOtp } from './auth.js';
import { syncRoutes } from './sync/routes.js';

const app = Fastify({ logger: { level: env.isProduction ? 'info' : 'debug' } });

await app.register(cookie);

const COOKIE = 'km_session';

/** Long-lived, httpOnly. Expiry in months, because re-auth is a support call (§12). */
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.isProduction,
  path: '/',
  maxAge: 180 * 86_400,
};

app.get('/health', async () => {
  await sql`select 1`;
  return { ok: true };
});

app.post('/auth/otp/request', async (request, reply) => {
  const { phone } = request.body as { phone?: string };
  if (!phone) return reply.status(400).send({ error: 'phone is required' });

  await requestOtp(phone);
  // Whether the number is known is not disclosed: it would let anyone probe
  // which families use the app.
  return reply.send({ sent: true, devCode: env.isProduction ? undefined : '123456' });
});

app.post('/auth/otp/verify', async (request, reply) => {
  const { phone, code, deviceId } = request.body as {
    phone?: string;
    code?: string;
    deviceId?: string;
  };
  if (!phone || !code) return reply.status(400).send({ error: 'phone and code are required' });

  const session = await verifyOtp(phone, code, deviceId ?? null);
  if (!session) return reply.status(401).send({ error: 'that code did not match' });

  return reply
    .setCookie(COOKIE, session.token, cookieOptions)
    .send({
      userId: session.userId,
      householdId: session.householdId,
      isNewUser: session.isNewUser,
    });
});

app.post('/auth/logout', async (request, reply) => {
  const token = request.cookies[COOKIE];
  if (token) await revokeSession(token);
  return reply.clearCookie(COOKIE, cookieOptions).send({ ok: true });
});

app.post('/auth/join', async (request, reply) => {
  const session = await sessionFor(request.cookies[COOKIE]);
  if (!session) return reply.status(401).send({ error: 'not signed in' });

  const { inviteCode } = request.body as { inviteCode?: string };
  if (!inviteCode) return reply.status(400).send({ error: 'inviteCode is required' });

  const joined = await joinHousehold(session.userId, inviteCode);
  if (!joined) return reply.status(404).send({ error: 'that code did not match a household' });
  return reply.send({ ok: true });
});

app.get('/auth/me', async (request, reply) => {
  const session = await sessionFor(request.cookies[COOKIE]);
  if (!session) return reply.status(401).send({ error: 'not signed in' });
  return reply.send(session);
});

/**
 * Every sync route runs as a signed-in user, and its household is taken from
 * the session — never from the request body (§6).
 */
syncRoutes(app, (request) => sessionFor(request.cookies[COOKIE]));

const close = async () => {
  await app.close();
  await sql.end();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);

export { app, COOKIE, cookieOptions };

if (!process.env.VITEST) {
  await app.listen({ port: env.port, host: env.host });
}
