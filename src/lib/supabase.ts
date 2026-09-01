/**
 * Database and storage client, server-only.
 *
 * Always the service role key, never the anon key. The browser never talks to
 * Supabase directly; every read and write goes through a Next.js route that
 * checks the session first, so RLS has no policies to grant.
 */

import 'server-only';

import { createClient } from '@supabase/supabase-js';

import type { Database } from './types';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const supabase = createClient<Database>(
  required('SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } },
);

export const BUILDING_IMAGES_BUCKET = 'building-images';
