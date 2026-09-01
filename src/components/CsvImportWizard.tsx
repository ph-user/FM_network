'use client';

import { useRef, useState } from 'react';
import Papa from 'papaparse';

import { BUILDING_TYPES, STATUSES } from '@/lib/types';
import {
  normalizeName,
  validateRow,
  CSV_COLUMNS,
  type RawImportRow,
  type ResolvedImportRow,
  type ImportCandidate,
} from '@/lib/csvImport';

import styles from './CsvImportWizard.module.css';

interface CsvImportWizardProps {
  onImported: () => void;
  onCancel: () => void;
}

interface RowState extends ResolvedImportRow {
  include: boolean;
  chosenCandidate?: ImportCandidate;
}

type Stage = 'pick' | 'reviewing' | 'committing' | 'done';

const EMPTY_RAW: RawImportRow = {
  id: '',
  name: '',
  address: '',
  levels: '',
  building_type: '',
  postcode: '',
  suburb: '',
  status: '',
  screen_count: '',
  notes: '',
};

function toRawRow(record: Record<string, string>): RawImportRow {
  const row = { ...EMPTY_RAW };
  for (const column of CSV_COLUMNS) {
    row[column] = (record[column] ?? '').trim();
  }
  return row;
}

function defaultInclude(row: ResolvedImportRow): boolean {
  if (row.duplicateInFile) return false;
  return row.status === 'new' || row.status === 'update';
}

function effectiveCandidate(row: RowState): ImportCandidate | undefined {
  return row.chosenCandidate ?? row.candidate;
}

export function CsvImportWizard({ onImported, onCancel }: CsvImportWizardProps) {
  const [stage, setStage] = useState<Stage>('pick');
  const [rows, setRows] = useState<RowState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState<number | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; failed: { name: string; error: string }[] } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  function recomputeDuplicates(current: RowState[]): RowState[] {
    const counts = new Map<string, number>();
    for (const row of current) {
      const name = row.raw.name.trim();
      if (!name) continue;
      const key = normalizeName(name);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return current.map((row) => {
      const name = row.raw.name.trim();
      const duplicateInFile = name ? (counts.get(normalizeName(name)) ?? 0) > 1 : false;
      return duplicateInFile === row.duplicateInFile ? row : { ...row, duplicateInFile, include: duplicateInFile ? false : row.include };
    });
  }

  async function handleFile(file: File) {
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const raw = results.data.map(toRawRow).filter((r) => r.name || r.address);
        if (raw.length === 0) {
          setError('No rows found in that file.');
          return;
        }
        await resolveRows(raw);
      },
      error: () => setError('Could not read that file.'),
    });
  }

  async function resolveRows(raw: RawImportRow[]) {
    setError(null);
    try {
      const response = await fetch('/api/buildings/import/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: raw }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? 'Could not resolve addresses.');
        return;
      }
      const data: { rows: ResolvedImportRow[] } = await response.json();
      const initial: RowState[] = data.rows.map((row) => ({ ...row, include: defaultInclude(row) }));
      setRows(recomputeDuplicates(initial));
      setStage('reviewing');
    } catch {
      setError('Could not reach the server. Check your connection.');
    }
  }

  async function recheckRow(rowIndex: number) {
    const row = rows.find((r) => r.rowIndex === rowIndex);
    if (!row) return;

    setRechecking(rowIndex);
    try {
      const response = await fetch('/api/buildings/import/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [row.raw] }),
      });
      if (!response.ok) return;
      const data: { rows: ResolvedImportRow[] } = await response.json();
      const updated = data.rows[0];
      setRows((prev) =>
        recomputeDuplicates(
          prev.map((r) =>
            r.rowIndex === rowIndex
              ? { ...updated, rowIndex, include: defaultInclude(updated), chosenCandidate: undefined }
              : r,
          ),
        ),
      );
    } finally {
      setRechecking(null);
    }
  }

  function updateRaw(rowIndex: number, field: keyof RawImportRow, value: string) {
    setRows((prev) =>
      recomputeDuplicates(prev.map((r) => (r.rowIndex === rowIndex ? { ...r, raw: { ...r.raw, [field]: value } } : r))),
    );
  }

  function chooseCandidate(rowIndex: number, placeId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        const chosen = r.candidates?.find((c) => c.placeId === placeId);
        return { ...r, chosenCandidate: chosen, include: !!chosen };
      }),
    );
  }

  function toggleInclude(rowIndex: number, include: boolean) {
    setRows((prev) => prev.map((r) => (r.rowIndex === rowIndex ? { ...r, include } : r)));
  }

  async function commit() {
    const included = rows.filter((r) => r.include);
    if (included.length === 0) return;

    setStage('committing');
    setError(null);

    try {
      const response = await fetch('/api/buildings/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: included.map((row) => {
            const validation = validateRow(row.raw, BUILDING_TYPES, STATUSES);
            const candidate = effectiveCandidate(row);
            return {
              id: row.existingId,
              name: row.raw.name.trim(),
              placeId: candidate?.placeId,
              levels: validation.ok ? validation.fields.levels : Number(row.raw.levels),
              building_type: row.raw.building_type,
              status: row.raw.status,
              screen_count: validation.ok ? validation.fields.screen_count : Number(row.raw.screen_count) || 0,
              notes: row.raw.notes,
            };
          }),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Could not import.');
        setStage('reviewing');
        return;
      }
      setResult(data);
      setStage('done');
    } catch {
      setError('Could not reach the server. Check your connection.');
      setStage('reviewing');
    }
  }

  if (stage === 'pick') {
    return (
      <div className={styles.pick}>
        <p className={styles.hint}>
          Columns: {CSV_COLUMNS.join(', ')}. Include <code>id</code> to update an existing building; leave it blank
          for a new one.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'done' && result) {
    return (
      <div className={styles.done}>
        <h2 className={styles.title}>Import complete</h2>
        <p>
          {result.created} created, {result.updated} updated.
        </p>
        {result.failed.length > 0 && (
          <div>
            <p className={styles.failedTitle}>{result.failed.length} row(s) could not be imported:</p>
            <ul className={styles.failedList}>
              {result.failed.map((f, i) => (
                <li key={i}>
                  {f.name}: {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className={styles.actions}>
          <button className="btn" onClick={onImported}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const includedCount = rows.filter((r) => r.include).length;

  return (
    <div className={styles.review}>
      <div className={styles.summary}>
        {includedCount} of {rows.length} row(s) will be imported.
      </div>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th></th>
              <th>Status</th>
              <th>Name</th>
              <th>Address</th>
              <th>Levels</th>
              <th>Type</th>
              <th>Status field</th>
              <th>Screens</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowIndex} className={row.duplicateInFile ? styles.duplicateRow : undefined}>
                <td>
                  <input
                    type="checkbox"
                    checked={row.include}
                    disabled={row.status === 'ambiguous' && !row.chosenCandidate}
                    onChange={(e) => toggleInclude(row.rowIndex, e.target.checked)}
                  />
                </td>
                <td>
                  <StatusBadge row={row} />
                </td>
                <td>
                  <input
                    className={styles.cellInput}
                    value={row.raw.name}
                    onChange={(e) => updateRaw(row.rowIndex, 'name', e.target.value)}
                  />
                </td>
                <td>
                  {row.status === 'ambiguous' ? (
                    <select
                      className={styles.cellInput}
                      value={row.chosenCandidate?.placeId ?? ''}
                      onChange={(e) => chooseCandidate(row.rowIndex, e.target.value)}
                    >
                      <option value="">Pick a match…</option>
                      {row.candidates?.map((c) => (
                        <option key={c.placeId} value={c.placeId}>
                          {c.address}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className={styles.addressCell}>
                      <input
                        className={styles.cellInput}
                        value={row.raw.address}
                        onChange={(e) => updateRaw(row.rowIndex, 'address', e.target.value)}
                      />
                      {(row.status === 'unresolved' || row.error) && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => recheckRow(row.rowIndex)}
                          disabled={rechecking === row.rowIndex}
                        >
                          {rechecking === row.rowIndex ? '…' : 'Search'}
                        </button>
                      )}
                      {row.candidate && <span className={styles.resolvedAddress}>{row.candidate.address}</span>}
                    </div>
                  )}
                  {row.error && <p className={styles.rowError}>{row.error}</p>}
                  {row.duplicateInFile && (
                    <p className={styles.rowError}>Another row in this file has the same name.</p>
                  )}
                </td>
                <td>
                  <input
                    className={styles.cellInputNarrow}
                    value={row.raw.levels}
                    onChange={(e) => updateRaw(row.rowIndex, 'levels', e.target.value)}
                  />
                </td>
                <td>
                  <select
                    className={styles.cellInput}
                    value={row.raw.building_type}
                    onChange={(e) => updateRaw(row.rowIndex, 'building_type', e.target.value)}
                  >
                    <option value="" />
                    {BUILDING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className={styles.cellInput}
                    value={row.raw.status}
                    onChange={(e) => updateRaw(row.rowIndex, 'status', e.target.value)}
                  >
                    <option value="" />
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className={styles.cellInputNarrow}
                    value={row.raw.screen_count}
                    onChange={(e) => updateRaw(row.rowIndex, 'screen_count', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.actions}>
        <button className="btn btn-secondary" onClick={onCancel} disabled={stage === 'committing'}>
          Cancel
        </button>
        <button className="btn" onClick={commit} disabled={includedCount === 0 || stage === 'committing'}>
          {stage === 'committing' ? 'Importing…' : `Import ${includedCount} row(s)`}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ row }: { row: RowState }) {
  const label =
    row.status === 'new'
      ? 'New'
      : row.status === 'update'
        ? 'Update'
        : row.status === 'ambiguous'
          ? row.chosenCandidate
            ? row.existingId
              ? 'Update'
              : 'New'
            : 'Ambiguous'
          : row.status === 'unresolved'
            ? 'Unresolved'
            : 'Invalid';
  return <span className={styles.badge}>{label}</span>;
}
