// src/utils/date.ts
// Utilities for parsing and formatting date-only strings (yyyy-mm-dd)

export type YyyyMmDd = `${number}-${number}-${number}`;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseYyyyMmDdToUtcDate(input: string): Date {
  const m = DATE_RE.exec(input);
  if (!m) throw new Error('Invalid date format, expected yyyy-mm-dd');
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) throw new Error('Invalid month');
  if (day < 1 || day > 31) throw new Error('Invalid day');
  const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  // Validate round-trip
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    throw new Error('Invalid date value');
  }
  return d;
}

export function formatDateToYyyyMmDd(date: Date): YyyyMmDd {
  const y = date.getUTCFullYear();
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}` as YyyyMmDd;
}

export function oneDayBeforeUtc(date: Date): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
