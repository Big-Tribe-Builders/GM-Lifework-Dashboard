/**
 * QuinB Community, the asset: the content plan and the posts.
 *
 * The plan mirrors her Notion: QuinB_CP_Year (a year theme), QuinB_CP_Montly_Themes
 * (a monthly theme with weeks), the Weekly Content Schedule (one post type per
 * weekday, with purpose, prompt and example) and QuinB_CP_Content (the posts).
 * Members live in src/lib/book.ts (QuinbMember).
 */

export const BANNER_BUCKET = 'quinb-banners';

/** The plan starts here: the new series begins in October 2026. */
export const PLAN_START = '2026-10';

/** Progress, as in her Notion, plus Approved and Posted. */
export type PostStatus =
  | 'idea' | 'planned' | 'next_up' | 'in_progress' | 'review'
  | 'approved' | 'scheduled' | 'posted' | 'hold' | 'cancelled';
export const POST_STATUS: Record<PostStatus, string> = {
  idea: 'Idea', planned: 'Planned', next_up: 'Next Up', in_progress: 'In progress', review: 'review',
  approved: 'Approved', scheduled: 'Scheduled', posted: 'Posted', hold: 'Hold', cancelled: 'Cancelled',
};
export const POST_TONE: Record<PostStatus, string> = {
  idea: 'sleeping', planned: 'sleeping', next_up: 'sleeping', in_progress: 'active', review: 'contact',
  approved: 'active', scheduled: 'done', posted: 'done', hold: 'archived', cancelled: 'archived',
};
export const POST_STATUSES = Object.keys(POST_STATUS) as PostStatus[];

export const AUDIENCES = ['External', 'Community'] as const;
export const POST_KINDS = ['Article', 'Question', 'Quick Post'] as const;

export type QuinbYear = { year: number; theme: string | null; audience: string | null; focus: string | null; goal: string | null; notes: string | null; updatedAt: string };
export type QuinbMonth = { month: string; theme: string | null; focus: string | null; goal: string | null; note: string | null; notebooklmUrl: string | null; updatedAt: string };
export type QuinbWeek = { monday: string; theme: string | null; plan: string | null; updatedAt: string };

export type QuinbPostType = {
  id: string;
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  title: string;
  kind: string | null;
  hour: string | null;
  space: string | null;
  postedBy: string | null;
  bannerUrl: string | null;
  purpose: string;
  prompt: string;
  example: string;
  updatedAt: string;
};

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
  postTypeId: string | null;
  updatedAt: string;
};
