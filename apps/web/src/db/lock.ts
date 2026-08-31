/**
 * A PIN gate on the app.
 *
 * Be clear about what this is and is not. All data lives in IndexedDB on this
 * one phone — there is no server, so nobody with the URL can reach it; they get
 * an empty app. The real exposure is someone picking up the handset, and that
 * is what this stops.
 *
 * It is a *gate*, not encryption: the records are still readable to anyone who
 * attaches a debugger to the browser. Encrypting them would mean encrypting
 * every indexed field and losing the ability to query offline, which is the one
 * thing the app cannot give up (CLAUDE.md §2.1). Real per-user protection
 * arrives with accounts at M2.
 *
 * The PIN is never stored. Only a PBKDF2 hash of it, with a random salt.
 */

const STORAGE_KEY = 'km.lock';
const ITERATIONS = 210_000;

interface StoredLock {
  salt: string;
  hash: string;
  iterations: number;
  /** Failed attempts since the last success, for back-off. */
  failures: number;
  /** Epoch ms until which entry is refused. */
  lockedUntil: number;
}

function read(): StoredLock | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredLock) : null;
  } catch {
    return null;
  }
}

function write(lock: StoredLock): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lock));
  } catch {
    // Storage blocked. The app must still open rather than trapping the user
    // out of their own records.
  }
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string) =>
  new Uint8Array((hex.match(/.{1,2}/g) ?? []).map((byte) => parseInt(byte, 16)));

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

export function isLockSet(): boolean {
  return read() !== null;
}

export async function setPin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  write({
    salt: toHex(salt),
    hash: await derive(pin, salt, ITERATIONS),
    iterations: ITERATIONS,
    failures: 0,
    lockedUntil: 0,
  });
}

/** Removes the gate entirely. Records are untouched. */
export function clearPin(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; the caller already told the user it may not have stuck.
  }
}

export interface UnlockResult {
  ok: boolean;
  /** Seconds the user must wait before trying again. */
  waitSeconds?: number;
}

/**
 * Wrong guesses slow down: a shoulder-surfer with a stolen phone gets a handful
 * of tries a minute, not thousands. Deliberately no lockout and no wipe — this
 * is a farmer's only copy of their own records, and a forgotten PIN must never
 * destroy them.
 */
export async function unlock(pin: string): Promise<UnlockResult> {
  const lock = read();
  if (!lock) return { ok: true };

  const now = Date.now();
  if (lock.lockedUntil > now) {
    return { ok: false, waitSeconds: Math.ceil((lock.lockedUntil - now) / 1000) };
  }

  const candidate = await derive(pin, fromHex(lock.salt), lock.iterations);
  if (candidate === lock.hash) {
    write({ ...lock, failures: 0, lockedUntil: 0 });
    return { ok: true };
  }

  const failures = lock.failures + 1;
  // Free for the first few fat-fingered tries, then a growing pause.
  const wait = failures < 4 ? 0 : Math.min(2 ** (failures - 3), 60);
  write({ ...lock, failures, lockedUntil: wait > 0 ? now + wait * 1000 : 0 });
  return { ok: false, waitSeconds: wait || undefined };
}

/** Minutes in the background before the app asks again. */
export const AUTO_LOCK_MINUTES = 5;
