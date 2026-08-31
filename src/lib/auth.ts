/**
 * Credential checking and route guards. Server-only.
 *
 * Two fixed accounts, "viewer" and "editor". Passwords live in the environment
 * as bcrypt hashes, so the repo and the browser bundle never contain them.
 */

import 'server-only';

import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

import { SESSION_COOKIE, verifySession, type Role, type Session } from './session';

/**
 * A hash of a value nobody will ever type. Used to keep the failure path the
 * same shape as the success path, so an unknown account name and a wrong
 * password take the same amount of time to reject.
 */
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.uCiJm9zSHcAKQFvGNjJ2mYmYaJ8Wg1i';

function hashFor(account: string): string | null {
  switch (account) {
    case 'viewer':
      return process.env.VIEWER_PASSWORD_HASH ?? null;
    case 'editor':
      return process.env.EDITOR_PASSWORD_HASH ?? null;
    default:
      return null;
  }
}

/** Returns the role if the credentials are right, otherwise null. */
export async function checkCredentials(account: string, password: string): Promise<Role | null> {
  const normalised = account.trim().toLowerCase();
  const hash = hashFor(normalised);

  const matches = await bcrypt.compare(password, hash ?? DUMMY_HASH);

  if (!hash || !matches) return null;
  return normalised as Role;
}

/** The current session, or null if there isn't a valid one. */
export async function getSession(): Promise<Session | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

export class AuthError extends Error {
  constructor(readonly status: 401 | 403, message: string) {
    super(message);
  }
}

/** Throws unless there is a valid session. Use at the top of read endpoints. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError(401, 'Sign in to continue.');
  return session;
}

/**
 * Throws unless the session is an editor. Use at the top of every endpoint that
 * writes. Hiding a button in the UI is not a permission check.
 */
export async function requireEditor(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== 'editor') {
    throw new AuthError(403, 'This account can view but not change buildings.');
  }
  return session;
}

/** Turns an AuthError into a response. Anything else is rethrown. */
export function authErrorResponse(error: unknown): Response | null {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
