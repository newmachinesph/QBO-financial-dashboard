import { NextResponse } from 'next/server';
import { runSync } from '@/lib/sync';

export const runtime = 'nodejs';
export const maxDuration = 300; // allow a long batch (Vercel Pro; Hobby caps lower)

// Cron target. Guarded by a shared secret so only your scheduler can trigger a sync.
export async function POST(req: Request) {
  if (req.headers.get('x-sync-secret') !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
