// The feeds of the site, by the path of their page. Components and the server both read it.

export const FEEDS = {
  '/': { api: 'news', title: 'Top', pages: 10 },
  '/new': { api: 'newest', title: 'New', pages: 12 },
  '/show': { api: 'show', title: 'Show', pages: 2 },
  '/ask': { api: 'ask', title: 'Ask', pages: 2 },
  '/jobs': { api: 'jobs', title: 'Jobs', pages: 1 },
} as const;

export type FeedPath = keyof typeof FEEDS;

/** The page of a feed that a URL asks for with `?page=`, from 1. */
export function getPage(url: string): number {
  const page = Number(new URL(url).searchParams.get('page') ?? 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
