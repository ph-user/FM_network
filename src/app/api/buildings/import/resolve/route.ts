import { requireEditorOrResponse } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { geocodeAddress } from '@/lib/places';
import { mapWithConcurrency } from '@/lib/concurrency';
import { BUILDING_TYPES, CITIES } from '@/lib/types';
import { normalizeName, validateRow, type RawImportRow, type ResolvedImportRow } from '@/lib/csvImport';

const MAX_ROWS = 300;
const MAX_CANDIDATES = 5;
const CONCURRENCY = 5;

export async function POST(request: Request) {
  const denied = await requireEditorOrResponse();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const rows: RawImportRow[] = Array.isArray(body?.rows) ? body.rows : [];

  if (rows.length === 0) {
    return Response.json({ error: 'No rows to resolve.' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return Response.json({ error: `Import is limited to ${MAX_ROWS} rows at a time.` }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase.from('buildings').select('id, name');
  if (existingError) {
    return Response.json({ error: 'Could not load existing buildings.' }, { status: 500 });
  }

  const existingIds = new Set(existing.map((b) => b.id));

  // Duplicates within the file itself -- both on id (two rows can't create/
  // update the same building) and on name (the DB's own uniqueness rule).
  const nameCounts = new Map<string, number>();
  const idCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.Name?.trim()) {
      const key = normalizeName(row.Name);
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }
    if (row.Id?.trim()) {
      const key = row.Id.trim();
      idCounts.set(key, (idCounts.get(key) ?? 0) + 1);
    }
  }

  const resolved = await mapWithConcurrency(rows, CONCURRENCY, async (raw, rowIndex): Promise<ResolvedImportRow> => {
    const duplicateInFile =
      (raw.Name?.trim() ? (nameCounts.get(normalizeName(raw.Name)) ?? 0) > 1 : false) ||
      (raw.Id?.trim() ? (idCounts.get(raw.Id.trim()) ?? 0) > 1 : false);

    const validation = validateRow(raw, CITIES, BUILDING_TYPES);
    if (!validation.ok) {
      return { rowIndex, raw, status: 'invalid', error: validation.error, duplicateInFile };
    }

    // Id is the client's own building id, always caller-supplied. Matching
    // an existing building means this row updates it; not matching means a
    // new building is created with that exact id (not a server-generated
    // one -- see CLAUDE.md).
    const id = raw.Id.trim();
    const existingId = existingIds.has(id) ? id : undefined;

    let candidates;
    try {
      candidates = (await geocodeAddress(raw.Address)).slice(0, MAX_CANDIDATES);
    } catch {
      return {
        rowIndex,
        raw,
        status: 'invalid',
        error: 'Could not search for that address. Try again.',
        existingId,
        duplicateInFile,
      };
    }

    if (candidates.length === 0) {
      return { rowIndex, raw, status: 'unresolved', existingId, duplicateInFile };
    }

    if (candidates.length === 1) {
      return {
        rowIndex,
        raw,
        status: existingId ? 'update' : 'new',
        existingId,
        duplicateInFile,
        candidate: candidates[0],
      };
    }

    return { rowIndex, raw, status: 'ambiguous', existingId, duplicateInFile, candidates };
  });

  return Response.json({ rows: resolved });
}
