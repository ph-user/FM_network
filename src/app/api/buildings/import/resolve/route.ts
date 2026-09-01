import { requireEditorOrResponse } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { geocodeAddress } from '@/lib/places';
import { mapWithConcurrency } from '@/lib/concurrency';
import { BUILDING_TYPES, STATUSES } from '@/lib/types';
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
  const existingByName = new Map(existing.map((b) => [normalizeName(b.name), b.id]));

  const nameCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.name?.trim()) continue;
    const key = normalizeName(row.name);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  const resolved = await mapWithConcurrency(rows, CONCURRENCY, async (raw, rowIndex): Promise<ResolvedImportRow> => {
    const duplicateInFile = raw.name?.trim() ? (nameCounts.get(normalizeName(raw.name)) ?? 0) > 1 : false;

    const validation = validateRow(raw, BUILDING_TYPES, STATUSES);
    if (!validation.ok) {
      return { rowIndex, raw, status: 'invalid', error: validation.error, duplicateInFile };
    }

    let existingId: string | undefined;
    let matchedBy: 'id' | 'name' | undefined;

    if (raw.id?.trim()) {
      if (!existingIds.has(raw.id.trim())) {
        return {
          rowIndex,
          raw,
          status: 'invalid',
          error: 'This id does not match an existing building.',
          duplicateInFile,
        };
      }
      existingId = raw.id.trim();
      matchedBy = 'id';
    } else {
      const byName = existingByName.get(normalizeName(raw.name));
      if (byName) {
        existingId = byName;
        matchedBy = 'name';
      }
    }

    let candidates;
    try {
      candidates = (await geocodeAddress(raw.address)).slice(0, MAX_CANDIDATES);
    } catch {
      return {
        rowIndex,
        raw,
        status: 'invalid',
        error: 'Could not search for that address. Try again.',
        existingId,
        matchedBy,
        duplicateInFile,
      };
    }

    if (candidates.length === 0) {
      return { rowIndex, raw, status: 'unresolved', existingId, matchedBy, duplicateInFile };
    }

    if (candidates.length === 1) {
      return {
        rowIndex,
        raw,
        status: existingId ? 'update' : 'new',
        existingId,
        matchedBy,
        duplicateInFile,
        candidate: candidates[0],
      };
    }

    return { rowIndex, raw, status: 'ambiguous', existingId, matchedBy, duplicateInFile, candidates };
  });

  return Response.json({ rows: resolved });
}
