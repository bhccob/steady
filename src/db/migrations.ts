import { PRAGMAS, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8, SCHEMA_V9 } from './schema';
import type { Db } from './types';

export const DB_NAME = 'steady.db';

/** Index i upgrades user_version i to i + 1. Append only. */
const MIGRATIONS: readonly string[] = [SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8, SCHEMA_V9];

/** Runs on every open: pragmas are per connection, migrations only when behind. */
export async function migrate(db: Db): Promise<void> {
  await db.execAsync(PRAGMAS);
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const from = row?.user_version ?? 0;

  for (let version = from; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version]!;
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
  }
}
