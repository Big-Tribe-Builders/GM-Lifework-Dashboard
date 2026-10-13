'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useColumnWidths, ResizeHandle } from '@/components/table';
import { FieldIcon } from '@/components/FieldIcon';
import { ColumnDialog } from '@/components/ColumnDialog';
import type { FieldType, ColumnSetting } from '@/lib/grid';

export type { FieldType } from '@/lib/grid';

/**
 * The grid, after Airtable.
 *
 * White cells, white header, and no fill anywhere: the structure is carried
 * entirely by three line weights — columns, rows, and the heavier rule under
 * the header. Rows are 32px. The first column carries the record number on
 * its left, the way Airtable folds the number into the primary field.
 *
 * It starts at the top left of its container with no padding and no card, so
 * the first line runs the whole width.
 */

export type Column<T> = {
  key: string;
  label: string;
  type: FieldType;
  width: number;
  /** Right-aligns the cell. Numbers and money read down the column. */
  numeric?: boolean;
  /** A column of buttons: no field glyph, no name, no resize edge. */
  bare?: boolean;
  /** An icon in the header instead of the field glyph and name; the name is
      then its tooltip and what a screen reader hears. */
  glyph?: ReactNode;
  render: (row: T) => ReactNode;
};

/** A fold: a run of rows behind one heading you can close. */
export type Group<T> = {
  key: string;
  head: ReactNode;
  /** Tints the fold row: the status colour, or 'grey' when there is none. */
  tone?: string;
  /** A palette colour she gave this group (src/lib/palette.ts); wins over the tone. */
  tint?: string | null;
  /** Controls on the right of the fold row, outside its open/close button. */
  tools?: ReactNode;
  rows: T[];
  open: boolean;
  onToggle: () => void;
  empty?: string;
};

export function Grid<T>({
  rows = [], columns, rowKey, store, empty = 'Nothing here.', groups, rowClass,
  settings = {}, onColumnSettings, accent,
}: {
  rows?: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Where this grid's column widths are remembered, per browser. */
  store: string;
  empty?: string;
  /** Folds. When given they replace `rows`, and rows number within a fold. */
  groups?: Group<T>[];
  rowClass?: (row: T) => string | undefined;
  /** Her renames and glyphs for this grid's columns, by column key. */
  settings?: Record<string, ColumnSetting>;
  /** Given, the header names open the column dialog and save through this. */
  onColumnSettings?: (key: string, input: { label: string; icon: FieldType }) => Promise<{ error: string | null }>;
  /** The zone's colour, so what is inside the grid (inputs, dialogs) uses it. */
  accent?: string;
}) {
  const { widths, resize } = useColumnWidths(store, columns.map((c) => c.width));
  const total = widths.reduce((a, b) => a + b, 0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const labelOf = (c: Column<T>) => settings[c.key]?.label ?? c.label;
  const iconOf = (c: Column<T>) => settings[c.key]?.icon ?? c.type;
  const editing = editingKey ? columns.find((c) => c.key === editingKey) : undefined;

  // Always in view (Giulia, 13 Oct 2026): the table scrolls inside itself, so
  // its header row and its sideways scrollbar stay on the screen. Here it is
  // fitted to the room left under it, so it ends at the bottom of the screen
  // and the page around it does not scroll. A table further down a long page
  // keeps the CSS default: the height of the screen under the chrome.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const fit = () => {
      const room = Math.floor(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY));
      const want = room >= Math.min(320, window.innerHeight / 2) ? `${room}px` : '';
      if (el.style.getPropertyValue('--grid-fit') === want) return;
      if (want) el.style.setProperty('--grid-fit', want); else el.style.removeProperty('--grid-fit');
    };
    fit();
    // What sits above the table can change (a note, an error, a form opening).
    const watch = new ResizeObserver(fit);
    watch.observe(document.body);
    window.addEventListener('resize', fit);
    return () => { watch.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  /** The rows of one run — the whole table, or one fold of it. */
  function body(list: T[], none: string) {
    if (list.length === 0) {
      return <tr><td colSpan={columns.length + 1} className="grid2__empty">{none}</td></tr>;
    }
    return list.map((row, n) => (
      <tr key={rowKey(row)} className={rowClass?.(row)}>
        {columns.map((c, i) => (
          <td
            key={c.key}
            className={[c.numeric ? 'grid2__num' : '', c.bare ? 'grid2__bare' : '']
              .filter(Boolean).join(' ') || undefined}
          >
            {i === 0 ? <span className="grid2__rownum">{n + 1}</span> : null}
            {c.render(row)}
          </td>
        ))}
        <td className="grid2__filler" />
      </tr>
    ));
  }

  return (
    <div className={accent ? `grid2 accent-${accent}` : 'grid2'}>
      <div className="grid2__scroll" ref={scroller}>
        {/* The table is 100% wide with a minimum of its columns, and carries a
            trailing filler cell. That is what makes every rule run the whole
            width of the page rather than stopping at the last field. */}
        <table className="grid2__table" style={{ minWidth: total }}>
          <colgroup>
            {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
            <col />
          </colgroup>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  className={[c.numeric ? 'grid2__num' : '', c.bare ? 'grid2__bare' : '']
                    .filter(Boolean).join(' ') || undefined}
                  aria-label={c.bare ? c.label : undefined}
                >
                  {i === 0 ? <span className="grid2__check" aria-hidden="true" /> : null}
                  {c.bare ? null : c.glyph ? (
                    <span className="grid2__field grid2__field--glyph" title={labelOf(c)}>
                      {c.glyph}
                      <span className="sr-only">{labelOf(c)}</span>
                    </span>
                  ) : onColumnSettings ? (
                    <button
                      type="button"
                      className="grid2__field grid2__fieldbtn"
                      title="Rename or change the icon"
                      onClick={() => setEditingKey(c.key)}
                    >
                      <FieldIcon type={iconOf(c)} />
                      <span className="grid2__fieldname">{labelOf(c)}</span>
                    </button>
                  ) : (
                    <span className="grid2__field">
                      <FieldIcon type={iconOf(c)} />
                      <span className="grid2__fieldname">{labelOf(c)}</span>
                    </span>
                  )}
                  {c.bare ? null : <ResizeHandle onResize={(dx) => resize(i, dx)} />}
                </th>
              ))}
              <th className="grid2__filler" aria-hidden="true" />
            </tr>
          </thead>
          {groups ? groups.map((g) => (
            <tbody key={g.key} className="grid2__group">
              <tr className={['grid2__fold', g.tone ? `grid2__fold--${g.tone}` : '', g.tint ? `tinted tint-${g.tint}` : ''].filter(Boolean).join(' ')}>
                <td colSpan={columns.length + 1}>
                  {g.tools ? (
                    // The whole row still opens and closes the fold, as before;
                    // the button stays the control for the keyboard. Clicks on
                    // the tools, or in a menu they open elsewhere on the page,
                    // are theirs.
                    <div className="grid2__foldrow" onClick={(e) => {
                      const t = e.target as Element;
                      if (!e.currentTarget.contains(t) || t.closest('.grid2__foldtools, .grid2__foldbtn')) return;
                      g.onToggle();
                    }}>
                      <div className="grid2__foldlead">
                        <FoldButton g={g} />
                        <span className="grid2__foldtools">{g.tools}</span>
                      </div>
                    </div>
                  ) : <FoldButton g={g} />}
                </td>
              </tr>
              {g.open ? body(g.rows, g.empty ?? empty) : null}
            </tbody>
          )) : <tbody>{body(rows, empty)}</tbody>}
        </table>
      </div>
      {editing && onColumnSettings ? (
        <ColumnDialog
          label={labelOf(editing)}
          icon={iconOf(editing)}
          onSave={(input) => onColumnSettings(editing.key, input)}
          onClose={() => setEditingKey(null)}
        />
      ) : null}
    </div>
  );
}

function FoldButton<T>({ g }: { g: Group<T> }) {
  return (
    <button type="button" className="grid2__foldbtn" aria-expanded={g.open} onClick={g.onToggle}>
      <span className="grid2__caret" aria-hidden="true">{g.open ? '\u25be' : '\u25b8'}</span>
      {g.head}
      <span className="grid2__count">{g.rows.length}</span>
    </button>
  );
}
