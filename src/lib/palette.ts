/**
 * The palette (Giulia, 10 Oct 2026): ten colours for everything she colours
 * herself — a list, a card, a status, a line on a plan. After Notion's
 * background colours: soft, see-through tints, never loud.
 *
 * Each colour is one class in studiolo-theme.css (`tint-<key>`) that sets
 * `--tint` (the colour, as rgb channels) and `--tint-ink` (text that stays
 * readable on it, 4.5:1 or better). What uses it decides how strong:
 * `.tinted` for a background, `.tint-tag` for a label, `.tint-swatch` for
 * the colour itself. The four brand colours stay the app's own; these are
 * hers to hand out.
 */

export const PALETTE = [
  { key: 'yellow', label: 'Yellow', hex: '#e9b10e' },
  { key: 'orange', label: 'Orange', hex: '#f6921f' },
  { key: 'red', label: 'Red', hex: '#ed1748' },
  { key: 'pink', label: 'Pink', hex: '#e0478f' },
  { key: 'purple', label: 'Purple', hex: '#8b4fd8' },
  { key: 'blue', label: 'Blue', hex: '#2f80ed' },
  { key: 'dark-green', label: 'Dark green', hex: '#17805b' },
  { key: 'light-green', label: 'Light green', hex: '#76c043' },
  { key: 'gray', label: 'Gray', hex: '#8b929c' },
  { key: 'brown', label: 'Brown', hex: '#9a6a4b' },
] as const;

export type PaletteKey = (typeof PALETTE)[number]['key'];

export const PALETTE_KEYS = PALETTE.map((p) => p.key) as readonly PaletteKey[];

export const isPaletteKey = (s: unknown): s is PaletteKey => typeof s === 'string' && (PALETTE_KEYS as readonly string[]).includes(s);

/** The class that puts a colour on an element, or nothing for no colour. */
export const tintClass = (key: string | null | undefined) => (isPaletteKey(key) ? `tint-${key}` : '');

/** A steady colour for a name, so the same person always gets the same one. */
export function paletteFor(name: string): PaletteKey {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length].key;
}

/** A colour she gave to one group: a list in a gallery, a fold in a table. */
export type ViewGroup = { grid: string; groupKey: string; color: string | null };

/** The colours for one collection, by group key. */
export function colorsFor(all: ViewGroup[] | undefined, grid: string): Record<string, PaletteKey> {
  const out: Record<string, PaletteKey> = {};
  for (const g of all ?? []) if (g.grid === grid && isPaletteKey(g.color)) out[g.groupKey] = g.color;
  return out;
}
