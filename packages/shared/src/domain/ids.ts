/**
 * UUIDv7, generated on the client. There are no server-assigned IDs and no
 * temp-ID rewriting anywhere in this system (CLAUDE.md §7).
 *
 * Hand-rolled rather than pulled from a package: it is 40 lines and the bundle
 * budget is 200 KB (§2.5). Monotonic within a millisecond so that outbox
 * entries created in the same tick still drain in creation order.
 */

const HEX: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

let lastMs = -1;
/** 12 bits of `rand_a`, used as a within-millisecond counter. */
let counter = 0;

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function uuidv7(now: number = Date.now()): string {
  if (now === lastMs) {
    counter = (counter + 1) & 0xfff;
    // Counter wrapped inside the same millisecond: borrow the next one rather
    // than emit a duplicate.
    if (counter === 0) now = ++lastMs;
  } else if (now > lastMs) {
    lastMs = now;
    counter = randomBytes(2)[0]! & 0x0ff; // leave headroom before the wrap
  } else {
    // Clock moved backwards. Keep issuing from the last millisecond we used.
    now = lastMs;
    counter = (counter + 1) & 0xfff;
  }

  const b = new Uint8Array(16);
  const ms = BigInt(now);

  b[0] = Number((ms >> 40n) & 0xffn);
  b[1] = Number((ms >> 32n) & 0xffn);
  b[2] = Number((ms >> 24n) & 0xffn);
  b[3] = Number((ms >> 16n) & 0xffn);
  b[4] = Number((ms >> 8n) & 0xffn);
  b[5] = Number(ms & 0xffn);

  b[6] = 0x70 | ((counter >> 8) & 0x0f); // version 7 + rand_a high nibble
  b[7] = counter & 0xff; // rand_a low byte

  const rand = randomBytes(8);
  b.set(rand, 8);
  b[8] = (b[8]! & 0x3f) | 0x80; // RFC 9562 variant

  const h = (i: number) => HEX[b[i]!]!;
  return (
    h(0) + h(1) + h(2) + h(3) + '-' +
    h(4) + h(5) + '-' +
    h(6) + h(7) + '-' +
    h(8) + h(9) + '-' +
    h(10) + h(11) + h(12) + h(13) + h(14) + h(15)
  );
}

/** Milliseconds encoded in a UUIDv7. Useful for ordering without a separate column. */
export function uuidv7Timestamp(id: string): number {
  return Number(BigInt('0x' + id.replace(/-/g, '').slice(0, 12)));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
