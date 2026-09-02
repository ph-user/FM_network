import 'server-only';

/**
 * Postgres error code 23505 (unique_violation) doesn't say which constraint
 * fired in a structured field Supabase exposes -- it's embedded in the
 * message text. Buildings has three unique constraints (id/pkey, name,
 * place_id), so a single generic "already exists" message would mislead
 * whichever one didn't actually fire -- e.g. two rows sharing an address
 * hit place_id, not name, and telling the user "name already exists" would
 * send them looking in the wrong place.
 */
export function buildingConflictMessage(error: { message: string }): string {
  if (error.message.includes('buildings_pkey')) return 'A building with this id already exists.';
  if (error.message.includes('buildings_place_id_key')) {
    return 'Another building already has this exact address.';
  }
  return 'A building with this name already exists.';
}
