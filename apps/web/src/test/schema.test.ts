/**
 * Every `db.<table>.where('<key>')` in the app must hit a declared index.
 *
 * Dexie does not check this until the query runs, so a missing index is invisible
 * in development until the exact screen that needs it opens — at which point it
 * throws mid-render and the user gets a blank page. That happened three times at
 * once: a khata's earnings, and both counts behind the field editor.
 *
 * This walks the source rather than the schema, so it catches the mistake in the
 * direction it is actually made: adding a query, forgetting the index.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { db } from '../db/db.js';

/** Resolved from this file, not the working directory, so the test runs from anywhere. */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** `db.sales.where('khataId')`, across line breaks as Prettier leaves them. */
const WHERE = /db\s*\.\s*(\w+)\s*\.\s*where\(\s*'([^']+)'/g;

interface Usage {
  file: string;
  table: string;
  key: string;
}

function queriesInSource(): Usage[] {
  const out: Usage[] = [];
  for (const file of sourceFiles(SRC)) {
    if (file.includes('/test/')) continue;
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(WHERE)) {
      out.push({ file, table: match[1]!, key: match[2]! });
    }
  }
  return out;
}

/** What Dexie will actually accept for a table: its primary key plus its indexes. */
function indexedKeys(table: string): Set<string> | null {
  const found = db.tables.find((t) => t.name === table);
  if (!found) return null;
  const keys = new Set<string>(found.schema.indexes.map((i) => i.keyPath as string));
  if (found.schema.primKey.keyPath) keys.add(found.schema.primKey.keyPath as string);
  return keys;
}

describe('Dexie queries match the schema', () => {
  it('finds the queries to check', () => {
    // A guard on the guard: if the regex ever stops matching, this test would
    // pass vacuously and stop protecting anything.
    expect(queriesInSource().length).toBeGreaterThan(15);
  });

  it('queries only tables that exist', () => {
    const missing = queriesInSource().filter((u) => indexedKeys(u.table) === null);
    expect(missing.map((u) => `${u.file}: db.${u.table}`)).toEqual([]);
  });

  it('queries only indexed keys', () => {
    const broken = queriesInSource().filter((u) => {
      const keys = indexedKeys(u.table);
      return keys !== null && !keys.has(u.key);
    });

    expect(
      broken.map((u) => `${u.file}: db.${u.table}.where('${u.key}') is not indexed`),
    ).toEqual([]);
  });
});

describe('the schema itself', () => {
  it('indexes the keys the khata and field screens depend on', () => {
    // These three are the ones that shipped broken. Named explicitly so a future
    // schema edit that drops them fails loudly.
    expect(indexedKeys('sales')).toContain('khataId');
    expect(indexedKeys('expenses')).toContain('fieldId');
    expect(indexedKeys('inventoryEntries')).toContain('fieldId');
  });
});
