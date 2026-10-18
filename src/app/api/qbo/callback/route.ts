import { NextResponse } from 'next/server';
import { oauthClient, saveToken } from '@/lib/qbo';

export const runtime = 'nodejs';

// Intuit redirects here with ?code=...&realmId=... — exchange for tokens and store them.
export async function GET(req: Request) {
  try {
    const res = await oauthClient().createToken(req.url);
    await saveToken(res.getToken());
    return NextResponse.redirect(new URL('/', req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
