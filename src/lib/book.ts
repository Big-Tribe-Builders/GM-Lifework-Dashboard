/**
 * The Big Tribe Builders book: one About row and the chapters.
 *
 * The body of a chapter is plain text, written in the app. Word counts are
 * computed here, never stored.
 */

export const BOOK_ID = 'big-tribe-builders';

export type Book = { id: string; title: string; description: string; style: string; updatedAt: string };

export type ChapterStatus = 'todo' | 'drafting' | 'review' | 'done';
export const CHAPTER_STATUS: Record<ChapterStatus, string> = { todo: 'To do', drafting: 'Drafting', review: 'Review', done: 'Done' };
export const CHAPTER_TONE: Record<ChapterStatus, string> = { todo: 'sleeping', drafting: 'active', review: 'contact', done: 'done' };

export type Chapter = {
  id: string;
  number: number;
  title: string;
  summary: string | null;
  body: string;
  status: ChapterStatus;
  updatedAt: string;
};

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** QuinB Academy members. The columns she named; the rest waits for Mighty Networks. */
export type QuinbMember = {
  id: string;
  name: string;
  email: string | null;
  memberSince: string | null;
  lastLogin: string | null;
  interactions: number | null;
  notes: string | null;
  updatedAt: string;
};
