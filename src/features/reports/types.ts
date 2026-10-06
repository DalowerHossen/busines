// src/features/reports/types.ts
// The shapes every report shares, so one table, one exporter and one page can
// render all of them.

export type ReportColumnKind = 'text' | 'money' | 'number' | 'date';

export interface ReportColumn {
  key: string;
  label: string;
  kind: ReportColumnKind;
}

export interface ReportCell {
  /** Already formatted for the screen and for the exports. */
  display: string;
  /** The raw value, used when a spreadsheet should hold a number. */
  raw: string | number | null;
}

export interface ReportRow {
  key: string;
  cells: ReportCell[];
}

export interface ReportResult {
  /** Key of the report that produced this table. */
  reportKey: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** The closing line. Every report has one, as the accountants asked. */
  totalRow: ReportRow;
  /** Period covered, shown under the title and in the exports. */
  periodLabel: string;
  /** True when the figures could not be read and an empty table is shown. */
  isDegraded: boolean;
}

export interface ReportPeriod {
  fromDate: string;
  toDate: string;
}

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  /** Short sentence shown on the card in the report library. */
  summary: string;
  /** Grouping used to lay the library out. */
  group: 'sales' | 'money' | 'spending' | 'clients';
}
