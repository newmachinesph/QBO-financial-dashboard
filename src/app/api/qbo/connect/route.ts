import { NextResponse } from 'next/server';
import OAuthClient from 'intuit-oauth';
import { oauthClient } from '@/lib/qbo';

export const runtime = 'nodejs';

// Kick off the Intuit consent flow. Client clicks this, authorizes, lands on /callback.
export async function GET() {
  const url = oauthClient().authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    // ponytail: static state — internal single-company tool. Use random value + cookie if this is ever public.
    state: 'qbo-connect',
  });
  return NextResponse.redirect(url);
}
