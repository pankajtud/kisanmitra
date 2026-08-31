/**
 * Signing in, and the state that follows from it.
 *
 * Being signed out is not an error: the app worked for months without a server
 * and still does. Signing in only adds a place for the records to also live.
 */
import { backfillFromLocalRecords, deviceId } from './outbox.js';
import { resetCursor } from './sync.js';

export interface Account {
  userId: string;
  householdId: string;
  role: string;
}

export async function currentAccount(): Promise<Account | null> {
  try {
    const response = await fetch('/auth/me', { credentials: 'include' });
    if (!response.ok) return null;
    return (await response.json()) as Account;
  } catch {
    // Offline. Not signed out — just unreachable, which is normal here.
    return null;
  }
}

export async function requestCode(phone: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/auth/otp/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return response.ok ? { ok: true } : { ok: false, error: `${response.status}` };
  } catch (cause) {
    return { ok: false, error: String(cause) };
  }
}

/**
 * Verifies the code, then queues everything already on this phone.
 *
 * A household may have been using the app offline for weeks. Those records are
 * real and must reach the server, so signing in pushes them rather than leaving
 * them stranded on one handset.
 */
export async function signIn(
  phone: string,
  code: string,
): Promise<{ ok: boolean; account?: Account; queued?: number; error?: string }> {
  try {
    const response = await fetch('/auth/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone, code, deviceId: deviceId() }),
    });

    if (!response.ok) return { ok: false, error: response.status === 401 ? 'code' : 'server' };

    const account = (await response.json()) as Account & { isNewUser: boolean };
    const queued = await backfillFromLocalRecords(account.householdId);
    return { ok: true, account, queued };
  } catch (cause) {
    return { ok: false, error: String(cause) };
  }
}

/** Joining the family's household with a six-digit code shared over WhatsApp (§12). */
export async function joinWithCode(inviteCode: string): Promise<boolean> {
  try {
    const response = await fetch('/auth/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ inviteCode }),
    });
    if (!response.ok) return false;
    // A different household means a different history to catch up on.
    resetCursor();
    return true;
  } catch {
    return false;
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // The cookie will expire on its own; local records are untouched either way.
  }
  resetCursor();
}
