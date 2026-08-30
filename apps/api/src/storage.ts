/**
 * Photos live on the local filesystem and are served via signed URLs. The
 * interface exists so this can move to S3/MinIO later without touching callers
 * (CLAUDE.md §4). Nothing here ever deletes a photo (§2.2).
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { env } from './env.js';

export interface PhotoStorage {
  /** Returns the storage path. Content-addressed, so re-uploading is a no-op. */
  put(householdId: string, bytes: Uint8Array, contentType: string): Promise<{ path: string; hash: string }>;
  get(path: string): Promise<Uint8Array>;
  signedUrl(path: string, ttlSeconds?: number): string;
  verifySignature(path: string, expires: number, signature: string): boolean;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class LocalPhotoStorage implements PhotoStorage {
  constructor(
    private readonly root: string = env.uploadDir,
    private readonly secret: string = process.env.SIGNING_SECRET ?? 'dev-signing-secret',
  ) {}

  async put(householdId: string, bytes: Uint8Array, contentType: string) {
    const hash = createHash('sha256').update(bytes).digest('hex');
    const ext = EXTENSIONS[contentType] ?? 'bin';
    // Fan out by hash prefix so no directory grows unbounded.
    const path = `${householdId}/${hash.slice(0, 2)}/${hash}.${ext}`;
    const absolute = join(this.root, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes, { flag: 'wx' }).catch((err: NodeJS.ErrnoException) => {
      // Already stored: same bytes, same hash. Nothing to do.
      if (err.code !== 'EEXIST') throw err;
    });
    return { path, hash };
  }

  async get(path: string) {
    return new Uint8Array(await readFile(join(this.root, this.safe(path))));
  }

  signedUrl(path: string, ttlSeconds = 3600) {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const signature = this.sign(path, expires);
    return `/photos/${path}?expires=${expires}&sig=${signature}`;
  }

  verifySignature(path: string, expires: number, signature: string) {
    if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(path, expires));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private sign(path: string, expires: number) {
    return createHmac('sha256', this.secret).update(`${path}:${expires}`).digest('hex');
  }

  /** Refuse traversal; storage paths are always household/prefix/hash.ext. */
  private safe(path: string) {
    if (path.includes('..') || path.startsWith('/')) throw new Error('bad photo path');
    return path;
  }
}

export const photoStorage: PhotoStorage = new LocalPhotoStorage();
