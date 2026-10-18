'use server';

import { revalidatePath } from 'next/cache';
import { runSync } from '@/lib/sync';

// Server action for the Sync button. Runs the ETL server-side, so no secret is exposed to the client.
export async function syncNow() {
  await runSync();
  revalidatePath('/');
}
