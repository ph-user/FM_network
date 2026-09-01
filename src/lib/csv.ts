import type { Building } from './types';

/**
 * Column order matches import/export in CLAUDE.md exactly, so a file
 * round-trips: export, edit in a spreadsheet, reimport as updates.
 */
const COLUMNS = [
  'id',
  'name',
  'address',
  'levels',
  'building_type',
  'postcode',
  'suburb',
  'status',
  'screen_count',
  'notes',
] as const;

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildingsToCsv(buildings: Building[]): string {
  const header = COLUMNS.join(',');
  const rows = buildings.map((building) =>
    COLUMNS.map((column) => escapeCell(building[column])).join(','),
  );
  return [header, ...rows].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
