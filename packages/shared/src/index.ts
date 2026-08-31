/**
 * Runtime-safe entry point. Everything exported here is either a pure helper or
 * a type — no `drizzle-orm` runtime reaches the web bundle. The schema itself is
 * behind the `@kisanmitra/shared/schema` subpath, which only the API imports.
 */
export * from './types.js';
export * from './domain/constants.js';
export * from './domain/dates.js';
export * from './domain/ids.js';
export * from './domain/khata.js';
export * from './domain/lot.js';
export * from './domain/money.js';
export * from './domain/season.js';
export * from './domain/sharing.js';
export * from './domain/stock.js';
export * from './domain/sync.js';
