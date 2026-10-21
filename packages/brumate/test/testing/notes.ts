'use server';

import { getEvent } from 'brumate/server';
import { notes } from './store.ts';

export async function listNotes(): Promise<string[]> {
  return [...notes];
}

export async function addNote(text: string): Promise<void> {
  const event = getEvent();
  notes.push(text);
  event.refresh(listNotes);
}
