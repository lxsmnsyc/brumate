'use server';

// The server functions of the site. Every visitor sees the same Hacker News,
// so `cached` keeps each answer for a minute, and requests share it.

import { cached } from 'brumate/server';
import { FEEDS } from './feeds.ts';
import type { FeedPath } from './feeds.ts';
import { clean, read } from './hn.ts';
import type { Comment, Item, Story, User } from './hn.ts';

/** A page of a feed, such as the second page of new stories. */
export const feed = cached(
  async (path: FeedPath, page: number): Promise<Story[]> =>
    (await read<Story[]>(`/${FEEDS[path].api}/${page}.json`)) ?? [],
  { maxAge: 60, tags: (path) => [`feed:${path}`] },
);

/** Makes the HTML of a comment and of the comments under it safe. */
function cleanComments(comments: Comment[]): Comment[] {
  const cleaned: Comment[] = [];
  for (const comment of comments) {
    cleaned.push({
      ...comment,
      content: clean(comment.content ?? ''),
      comments: cleanComments(comment.comments ?? []),
    });
  }
  return cleaned;
}

/** A story with its comments, or undefined for an ID that is not one. */
export const item = cached(
  async (id: number): Promise<Item | undefined> => {
    const found = await read<Item>(`/item/${id}.json`);
    return (
      found && {
        ...found,
        content: clean(found.content ?? ''),
        comments: cleanComments(found.comments ?? []),
      }
    );
  },
  { maxAge: 60, tags: (id) => [`item:${id}`] },
);

/** A user, or undefined for a name that is not one. */
export const user = cached(
  async (id: string): Promise<User | undefined> => {
    const found = await read<User>(`/user/${encodeURIComponent(id)}.json`);
    return found && { ...found, about: found.about ? clean(found.about) : undefined };
  },
  { maxAge: 300, tags: (id) => [`user:${id}`] },
);
