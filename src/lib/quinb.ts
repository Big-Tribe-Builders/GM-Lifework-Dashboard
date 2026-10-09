/**
 * QuinB Community, the asset: the content strategy and the posts we
 * pre-create. Members live in src/lib/book.ts (QuinbMember).
 */

export const STRATEGY_ID = 'quinb';
export const BANNER_BUCKET = 'quinb-banners';

export type PostStatus = 'idea' | 'draft' | 'ready' | 'posted';
export const POST_STATUS: Record<PostStatus, string> = { idea: 'Idea', draft: 'Draft', ready: 'Ready', posted: 'Posted' };
export const POST_TONE: Record<PostStatus, string> = { idea: 'sleeping', draft: 'active', ready: 'contact', posted: 'done' };

export type QuinbStrategy = { id: string; body: string; updatedAt: string };

export type QuinbPost = {
  id: string;
  title: string;
  body: string;
  bannerUrl: string | null;
  /** Where in the community it goes: the Space, in her words. */
  space: string | null;
  plannedFor: string | null;
  status: PostStatus;
  /** The link to the post once it is live in the community. */
  postedUrl: string | null;
  updatedAt: string;
};
