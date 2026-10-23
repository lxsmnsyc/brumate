// Reads Hacker News from the HNPWA API, which gives a page of a feed, an item
// with its comments, or a user in one request. Only the server imports this
// module, through the server functions of src/api.ts.

const API = process.env.HN_API ?? 'https://api.hnpwa.com/v0';

export { FEEDS } from './feeds.ts';
export type { FeedPath } from './feeds.ts';

export interface Story {
  id: number;
  title: string;
  points?: number | null;
  user?: string | null;
  time_ago: string;
  comments_count: number;
  type: 'link' | 'ask' | 'job';
  url: string;
  domain?: string;
}

export interface Comment {
  id: number;
  user?: string | null;
  time_ago: string;
  /** HTML that `clean` made safe. */
  content: string;
  comments: Comment[];
  deleted?: boolean;
}

export interface Item extends Omit<Story, 'comments_count'> {
  comments_count: number;
  /** The text of an Ask HN or a job, as HTML that `clean` made safe. */
  content: string;
  comments: Comment[];
}

export interface User {
  id: string;
  created: string;
  karma: number;
  /** HTML that `clean` made safe. */
  about?: string;
}

/** Answers of the API by path, for the tests, which run without the network. */
let fixtures: Record<string, unknown> | undefined;

/** Makes the API answer from `answers`, by path such as `/news/1.json`, or from the network again. */
export function useFixtures(answers: Record<string, unknown> | undefined): void {
  fixtures = answers;
}

/** Reads a path of the API, or undefined when it has nothing there. */
export async function read<T>(path: string): Promise<T | undefined> {
  if (fixtures) {
    return fixtures[path] as T | undefined;
  }
  const response = await fetch(`${API}${path}`);
  if (!response.ok) {
    if (response.status === 404) {
      return undefined;
    }
    throw new Error(`Hacker News answered ${response.status} for ${path}`);
  }
  // The API answers `null` for an item or a user that does not exist.
  return ((await response.json()) as T | null) ?? undefined;
}

/** The tags that the text of the site uses, which `clean` keeps. */
const ALLOWED = new Set(['p', 'a', 'i', 'em', 'b', 'strong', 'pre', 'code', 'br']);

/**
 * Keeps only the tags of `ALLOWED`, without their attributes, and the
 * `href` of links to http and https URLs. The site escapes its text, and
 * this keeps the page safe even if it did not.
 */
export function clean(html: string): string {
  return html.replace(
    /<(\/?)([a-z0-9]+)([^>]*)>/gi,
    (_, slash: string, name: string, rest: string) => {
      const tag = name.toLowerCase();
      if (!ALLOWED.has(tag)) {
        return '';
      }
      if (tag === 'a' && !slash) {
        const href = /href="(https?:\/\/[^"]*)"/i.exec(rest)?.[1];
        return href ? `<a href="${href}" rel="nofollow noreferrer">` : '<a>';
      }
      return `<${slash}${tag}>`;
    },
  );
}
