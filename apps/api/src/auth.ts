/**
 * Phone number plus a six-digit SMS code. No email, no password, ever (§12).
 *
 * Sessions last months, not hours: re-authenticating a farmer is a support call
 * in this context, not a minor inconvenience.
 *
 * The SMS provider is behind `sendOtp` so the rest of the code does not know
 * which one is in use. In development the code is fixed, so nothing here is
 * blocked on DLT template registration — which takes days and has not been
 * started (§4).
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { uuidv7 } from '@kisanmitra/shared';
import { db, schema } from './db/client.js';
import { env } from './env.js';

/** Months, per §12. */
const SESSION_DAYS = 180;
const OTP_TTL_MS = 10 * 60_000;
const MAX_OTP_ATTEMPTS = 5;
/** Fixed in development so auth can be tested without a live SMS route. */
export const DEV_OTP = '123456';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export interface SmsSender {
  send(phone: string, code: string): Promise<void>;
}

/** Logs instead of sending. Replaced by MSG91 once DLT registration clears. */
export const consoleSms: SmsSender = {
  async send(phone, code) {
    console.log(`[otp] ${phone} -> ${code}`);
  },
};

export async function requestOtp(phone: string, sms: SmsSender = consoleSms): Promise<void> {
  const code = env.isProduction ? String(randomInt(0, 1_000_000)).padStart(6, '0') : DEV_OTP;

  await db.insert(schema.otpCodes).values({
    id: uuidv7(),
    phone,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sms.send(phone, code);
}

export interface VerifiedSession {
  token: string;
  userId: string;
  householdId: string;
  isNewUser: boolean;
}

/**
 * Checks a code and starts a session.
 *
 * A first-time number gets a household of its own; joining an existing one is a
 * separate step with an invite code, so a mistyped number never lands someone
 * in another family's books.
 */
export async function verifyOtp(
  phone: string,
  code: string,
  deviceId: string | null,
): Promise<VerifiedSession | null> {
  const rows = await db
    .select()
    .from(schema.otpCodes)
    .where(
      and(
        eq(schema.otpCodes.phone, phone),
        isNull(schema.otpCodes.consumedAt),
        gt(schema.otpCodes.expiresAt, new Date()),
      ),
    );

  const candidate = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!candidate || candidate.attempts >= MAX_OTP_ATTEMPTS) return null;

  const given = Buffer.from(sha256(code));
  const expected = Buffer.from(candidate.codeHash);
  const matches = given.length === expected.length && timingSafeEqual(given, expected);

  if (!matches) {
    await db
      .update(schema.otpCodes)
      .set({ attempts: candidate.attempts + 1 })
      .where(eq(schema.otpCodes.id, candidate.id));
    return null;
  }

  await db
    .update(schema.otpCodes)
    .set({ consumedAt: new Date() })
    .where(eq(schema.otpCodes.id, candidate.id));

  const existing = (
    await db.select().from(schema.users).where(eq(schema.users.phone, phone)).limit(1)
  )[0];

  const user = existing ?? (await createHouseholdFor(phone));
  const token = randomBytes(32).toString('base64url');

  await db.insert(schema.sessions).values({
    id: uuidv7(),
    userId: user.id,
    tokenHash: sha256(token),
    deviceId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });

  return {
    token,
    userId: user.id,
    householdId: user.householdId,
    isNewUser: !existing,
  };
}

/** A household is created by its first user (§12). */
async function createHouseholdFor(phone: string) {
  const householdId = uuidv7();
  const userId = uuidv7();

  return db.transaction(async (tx) => {
    await tx.insert(schema.households).values({
      id: householdId,
      name: '',
      inviteCode: String(randomInt(0, 1_000_000)).padStart(6, '0'),
    });
    const rows = await tx
      .insert(schema.users)
      .values({ id: userId, householdId, phone, displayName: '', role: 'owner' })
      .returning();
    return rows[0]!;
  });
}

export interface Session {
  userId: string;
  householdId: string;
  role: string;
}

export async function sessionFor(token: string | undefined): Promise<Session | null> {
  if (!token) return null;

  const rows = await db
    .select({
      userId: schema.users.id,
      householdId: schema.users.householdId,
      role: schema.users.role,
      sessionId: schema.sessions.id,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, sha256(token)),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  // Cheap liveness, so an unused session can be spotted later.
  void db
    .update(schema.sessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.sessions.id, found.sessionId));

  return { userId: found.userId, householdId: found.householdId, role: found.role };
}

/** Family join over WhatsApp: a six-digit code, not a link (§12). */
export async function joinHousehold(userId: string, inviteCode: string): Promise<boolean> {
  const household = (
    await db.select().from(schema.households).where(eq(schema.households.inviteCode, inviteCode)).limit(1)
  )[0];
  if (!household) return false;

  await db
    .update(schema.users)
    .set({ householdId: household.id, role: 'member' })
    .where(eq(schema.users.id, userId));
  return true;
}

export async function revokeSession(token: string): Promise<void> {
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(eq(schema.sessions.tokenHash, sha256(token)));
}
