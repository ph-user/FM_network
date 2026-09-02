import type { Building } from './types';
import { CSV_COLUMNS } from './csvImport';

/**
 * Column order matches import/export in CLAUDE.md exactly, so a file
 * round-trips: export, edit in a spreadsheet, reimport as updates. Header
 * names match the client's own spreadsheet vocabulary; the accessors read
 * from this app's field names underneath.
 */
const ACCESSORS: Record<(typeof CSV_COLUMNS)[number], (b: Building) => string | number> = {
  City: (b) => b.city,
  Id: (b) => b.id,
  Name: (b) => b.name,
  Type: (b) => b.building_type.join(','),
  Suburb: (b) => b.suburb,
  Address: (b) => b.address,
  Level: (b) => b.levels ?? '',
  Screen: (b) => b.screen_count,
  Population: (b) => b.population ?? '',
  Note: (b) => b.notes,
};

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildingsToCsv(buildings: Building[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = buildings.map((building) =>
    CSV_COLUMNS.map((column) => escapeCell(ACCESSORS[column](building))).join(','),
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
