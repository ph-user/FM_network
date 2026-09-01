import { cookies } from 'next/headers';

import { checkCredentials } from '@/lib/auth';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/session';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const account = typeof body?.account === 'string' ? body.account : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!account || !password) {
    return Response.json({ error: 'Account and password are required.' }, { status: 400 });
  }

  const role = await checkCredentials(account, password);
  if (!role) {
    return Response.json({ error: 'Wrong account or password.' }, { status: 401 });
  }

  const token = await signSession(role);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions);

  return Response.json({ role });
}
