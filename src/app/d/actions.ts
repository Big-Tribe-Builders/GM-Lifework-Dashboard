'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase';
import { ICON_CHOICES, ACCENT_CHOICES, GROUP_ORDER, DOMAIN_BY_SLUG, resolveNav, overrideMap } from '@/lib/nav';
import { getDomainSettings, getCollectionOrder } from '@/lib/data';
import { FIELD_TYPES } from '@/lib/grid';
import { isPaletteKey } from '@/lib/palette';

/**
 * Rename or recolour a domain.
 *
 * Only the three fields she can reach from the interface are written, and
 * each is checked against the set the code knows how to render — a value
 * that is not one of ours never reaches the database.
 */
export async function saveDomainSettings(
  slug: string,
  input: { name: string; icon: string; accent: string },
): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured, so there is nowhere to save this.' };

  const name = input.name.trim();
  if (!name) return { error: 'A domain needs a name.' };
  if (!ICON_CHOICES.includes(input.icon as never)) return { error: 'That is not one of the icons.' };
  if (!ACCENT_CHOICES.includes(input.accent as never)) return { error: 'That is not one of the colours.' };

  const { error } = await db
    .from('domain_settings')
    .upsert({ slug, name, icon: input.icon, accent: input.accent, updated_at: new Date().toISOString() });

  if (error) return { error: error.message };

  // The name and colour are in the rail and the chrome, which every page
  // draws, so the whole layout is revalidated rather than one route.
  revalidatePath('/', 'layout');
  return { error: null };
}

/**
 * Give a group a colour from the palette — a list in a gallery, a fold in a
 * table — or take it away with ''. Keyed by the collection and the group, so
 * the same year can be red in one tab and blue in another.
 */
export async function saveGroupColor(grid: string, groupKey: string, color: string): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured, so there is nowhere to save this.' };
  if (!/^[a-z0-9][a-z0-9/_.-]{0,99}$/.test(grid)) return { error: 'Unknown collection.' };
  const key = groupKey.trim();
  if (!key || key.length > 60) return { error: 'Unknown group.' };
  if (color && !isPaletteKey(color)) return { error: 'That is not one of the ten colours.' };

  const { error } = color
    ? await db.from('view_groups').upsert({ grid, group_key: key, color, updated_at: new Date().toISOString() })
    : await db.from('view_groups').delete().eq('grid', grid).eq('group_key', key);
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { error: null };
}

/**
 * Rename a grid column or change its glyph.
 *
 * Keyed by the grid and the column, so the same column key in two grids can
 * carry two names. The glyph must be one the grid knows how to draw.
 */
export async function saveGridColumn(
  grid: string,
  key: string,
  input: { label: string; icon: string },
): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured, so there is nowhere to save this.' };

  const label = input.label.trim();
  if (!label) return { error: 'A column needs a name.' };
  if (!FIELD_TYPES.includes(input.icon as never)) return { error: 'That is not one of the icons.' };

  const { error } = await db
    .from('grid_columns')
    .upsert({ grid, key, label, icon: input.icon, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { error: null };
}

// ------------------------------------------------------------- moving things

/**
 * Read the rail as it stands, so a move is computed against what she sees.
 *
 * Every move rewrites the whole affected run rather than one row. Storing a
 * single new position leaves the neighbours tied, and a tie sorts however the
 * database feels like that day.
 */
async function currentNav() {
  const [{ rows: domains }, { rows: collections }] = await Promise.all([
    getDomainSettings(), getCollectionOrder(),
  ]);
  return { sections: resolveNav(overrideMap(domains), collections), domains, collections };
}

/**
 * Move a space one place up or down inside its own collection.
 *
 * From the rail, `visibleOnly`: the step is to the next space she can see
 * there, past any hidden ones, so a move always shows. Settings lists the
 * hidden spaces too, so there a step is one place.
 */
export async function moveDomain(slug: string, dir: 'up' | 'down', opts: { visibleOnly?: boolean } = {}): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured, so there is nowhere to save this.' };

  const { sections } = await currentNav();
  const section = sections.find((s) => s.domains.some((d) => d.slug === slug));
  if (!section) return { error: 'That space is not in the rail.' };

  const order = section.domains.map((d) => d.slug);
  const i = order.indexOf(slug);
  const step = dir === 'up' ? -1 : 1;
  let j = i + step;
  if (opts.visibleOnly) while (j >= 0 && j < order.length && section.domains[j].hidden) j += step;
  if (j < 0 || j >= order.length) return { error: null };   // already at the end
  // Take it out and put it on the far side of that neighbour; hidden spaces
  // in between keep their order.
  order.splice(i, 1);
  order.splice(j, 0, slug);

  const { error } = await db.from('domain_settings').upsert(
    order.map((s, n) => ({ slug: s, group_name: section.group, sort_order: n })),
  );
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { error: null };
}

/** Move a space into another collection, at the end of it. */
export async function moveDomainToCollection(
  slug: string, group: string,
): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured, so there is nowhere to save this.' };
  if (!GROUP_ORDER.includes(group as never)) return { error: 'That is not one of the collections.' };

  const { sections } = await currentNav();
  const target = sections.find((s) => s.group === group);
  const end = target ? target.domains.length : 0;

  const { error } = await db
    .from('domain_settings')
    .upsert({ slug, group_name: group, sort_order: end });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { error: null };
}

/**
 * Move a whole collection up or down the rail. From the rail, `visibleOnly`
 * steps past collections whose spaces are all hidden (the rail does not
 * draw those), so a move always shows.
 */
export async function moveCollection(
  name: string, dir: 'up' | 'down', opts: { visibleOnly?: boolean } = {},
): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured, so there is nowhere to save this.' };

  const { sections } = await currentNav();
  const order = sections.map((s) => s.group);
  const i = order.indexOf(name);
  if (i === -1) return { error: 'That collection is not in the rail.' };
  const step = dir === 'up' ? -1 : 1;
  let j = i + step;
  if (opts.visibleOnly) while (j >= 0 && j < order.length && sections[j].domains.every((d) => d.hidden)) j += step;
  if (j < 0 || j >= order.length) return { error: null };
  order.splice(i, 1);
  order.splice(j, 0, name);

  const { error } = await db.from('collection_settings').upsert(
    order.map((n, k) => ({ name: n, sort_order: k, updated_at: new Date().toISOString() })),
  );
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { error: null };
}

// ------------------------------------------------------------- hiding things

/** Hide a space from the rail, or show it again. Nothing is deleted. */
export async function setSpaceHidden(slug: string, hidden: boolean): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured, so there is nowhere to save this.' };
  if (!DOMAIN_BY_SLUG.has(slug)) return { error: 'That space does not exist.' };

  const { error } = await db.from('domain_settings').upsert({ slug, hidden, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { error: null };
}

/**
 * Hide one tab of a space from its tab strip, or show it again. At least one
 * tab stays shown: a space with every tab hidden would have nothing to open.
 */
export async function setTabHidden(slug: string, tab: string, hidden: boolean): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured, so there is nowhere to save this.' };
  const domain = DOMAIN_BY_SLUG.get(slug);
  if (!domain) return { error: 'That space does not exist.' };
  if (!domain.tabs.some((t) => t.slug === tab)) return { error: 'That tab does not exist.' };

  const { data, error: readError } = await db.from('domain_settings').select('hidden_tabs').eq('slug', slug).maybeSingle();
  if (readError) return { error: readError.message };
  const now = new Set<string>(((data?.hidden_tabs as string[] | null) ?? []).filter((t) => domain.tabs.some((x) => x.slug === t)));
  if (hidden) now.add(tab); else now.delete(tab);
  if (now.size >= domain.tabs.length) return { error: 'One tab has to stay. To take the whole space away, hide the space.' };

  const { error } = await db.from('domain_settings').upsert({ slug, hidden_tabs: [...now], updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { error: null };
}

/** Her name for one tab of a space; an empty name gives the tab its own name back. */
export async function renameTab(slug: string, tab: string, name: string): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured, so there is nowhere to save this.' };
  const domain = DOMAIN_BY_SLUG.get(slug);
  const base = domain?.tabs.find((t) => t.slug === tab);
  if (!domain || !base) return { error: 'That tab does not exist.' };
  const v = name.trim();
  if (v.length > 40) return { error: 'Forty characters at most.' };

  const { data, error: readError } = await db.from('domain_settings').select('tab_names').eq('slug', slug).maybeSingle();
  if (readError) return { error: readError.message };
  const names: Record<string, string> = { ...((data?.tab_names as Record<string, string> | null) ?? {}) };
  if (v && v !== base.label) names[tab] = v; else delete names[tab];

  const { error } = await db.from('domain_settings').upsert({ slug, tab_names: names, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { error: null };
}
