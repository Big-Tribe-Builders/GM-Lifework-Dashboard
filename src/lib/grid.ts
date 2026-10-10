/**
 * What a grid column can be, and what she can change about one.
 *
 * The glyph in a header is the field's type, the way Airtable draws it. She
 * can rename a column and pick a different glyph; both are kept in
 * grid_columns, keyed by the grid and the column, so they follow her to
 * every browser.
 */

import type { ViewGroup } from '@/lib/palette';

export type FieldType = 'text' | 'number' | 'currency' | 'date' | 'select' | 'link' | 'check';

export const FIELD_TYPES: FieldType[] = ['text', 'number', 'currency', 'date', 'select', 'link', 'check'];

export const FIELD_LABEL: Record<FieldType, string> = {
  text: 'Text',
  number: 'Number',
  currency: 'Money',
  date: 'Date',
  select: 'Status',
  link: 'Link',
  check: 'Checkbox',
};

/** One row of grid_columns: a rename or a new glyph for one column. */
export type ColumnSetting = {
  grid: string;
  key: string;
  label: string | null;
  icon: FieldType | null;
};

/** The settings of one grid, keyed by column, from the rows of every grid. */
export function columnsFor(rows: ColumnSetting[], grid: string): Record<string, ColumnSetting> {
  const out: Record<string, ColumnSetting> = {};
  for (const r of rows) if (r.grid === grid) out[r.key] = r;
  return out;
}

/** The clients grid, as grid_columns and localStorage both know it. */
export const CLIENTS_GRID = 'lifework.clients.cols';

/** What the page hands a zone besides its data: the URL's view state. */
export type ViewOpts = {
  /** A client id to show in the panel on the right. */
  peek?: string;
  /** Every column rename and glyph, for every grid. */
  columns?: ColumnSetting[];
  /** Table or gallery, for a tab that offers both (?view=). */
  mode?: ViewMode;
  /** Every colour she gave a group (a list, a fold), for every collection. */
  groupColors?: ViewGroup[];
};

/** How a tab can draw its rows. The first a tab lists is where it opens. */
export type ViewMode = 'table' | 'gallery';
export const VIEW_MODES: ViewMode[] = ['table', 'gallery'];
export const VIEW_LABEL: Record<ViewMode, string> = { table: 'Table', gallery: 'Gallery' };
