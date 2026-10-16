import type { QuinbMember } from '@/lib/book';

/**
 * QuinB Community › Members: the filters in the toolbar's dropdown (Giulia,
 * 16 Oct 2026: one list, "new members" is just a filter, and "inactive
 * members, people who haven't been in the community for a while"). The
 * choice lives in the address (?show=new), so a reload or a link keeps it.
 */
export type MemberFilter = 'all' | 'new' | 'inactive';

export const NEW_DAYS = 30;
export const INACTIVE_DAYS = 30;

export const MEMBER_FILTER_PARAM = 'show';

export const MEMBER_FILTERS: { key: MemberFilter; label: string; hint: string }[] = [
  { key: 'all', label: 'All members', hint: 'Everyone in the list' },
  { key: 'new', label: 'New members', hint: `Joined in the last ${NEW_DAYS} days` },
  { key: 'inactive', label: 'Inactive members', hint: `No visit in the last ${INACTIVE_DAYS} days` },
];

export const memberFilterOf = (v: string | null | undefined): MemberFilter => (v === 'new' || v === 'inactive' ? v : 'all');

/** The day `days` ago, as yyyy-mm-dd in her time zone, to compare with the stored dates. */
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Europe/Brussels' });

/** New: joined in the last NEW_DAYS days. Inactive: no visit in the last INACTIVE_DAYS days, or none known. */
export function inFilter(m: QuinbMember, f: MemberFilter): boolean {
  if (f === 'new') return !!m.memberSince && m.memberSince >= daysAgo(NEW_DAYS);
  if (f === 'inactive') return !m.lastLogin || m.lastLogin < daysAgo(INACTIVE_DAYS);
  return true;
}
