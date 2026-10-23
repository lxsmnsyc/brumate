'use server';

import { cached, revalidate } from 'brumate/server';

// A file of server functions. The browser gets functions that call the server.
// Kept in memory for the example. A real app would use a database.
const notes: string[] = [];

// Every visitor sees the same notes, so requests share the list for a minute. Adding a note
// drops it, and the pages that showed it.
export const listNotes = cached(async (): Promise<string[]> => [...notes], {
  name: 'notes',
  maxAge: 60,
  tags: ['notes'],
});

export async function addNote(form: FormData): Promise<{ error: string }> {
  const text = String(form.get('text') ?? '').trim();
  if (!text) {
    return { error: 'Write a note' };
  }
  notes.push(text);
  await revalidate('notes');
  return { error: '' };
}
