// One-off: null the sync watermark so the next sync does a full pull of all entities.
// Run once after adding new entity tables. `npm run reset:watermark`
import { config } from 'dotenv';
config({ path: '.env.local' });

// Dynamic import: db/index.ts reads DATABASE_URL at import time, so config() must run first.
async function main() {
  const { db } = await import('../src/db');
  const { qboConnection } = await import('../src/db/schema');
  await db.update(qboConnection).set({ lastSyncAt: null });
  console.log('Watermark reset. Next sync is a full pull.');
}

main().then(() => process.exit(0));
