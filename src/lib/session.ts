/**
 * Session token handling.
 *
 * Kept free of Node-only dependencies so that middleware, which runs on the
 * Edge runtime, can verify a token without pulling in bcrypt.
 */

import { SignJWT, jwtVerify } from 'jose';

export type Role = 'viewer' | 'editor';

export const SESSION_COOKIE = 'fm_session';

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours, roughly a working day

export interface Session {
  role: Role;
}

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error('SESSION_SECRET is not set');
  }
  return new TextEncoder().encode(value);
}

export async function signSession(role: Role): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const role = payload.role;
    if (role !== 'viewer' && role !== 'editor') return null;
    return { role };
  } catch {
    // Expired, tampered with, or signed by a different secret.
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
};
