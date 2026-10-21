'use server';

// A file of server functions. The browser gets functions that call the server.
// Kept in memory for the example. A real app would use a database.
const notes: string[] = [];

export async function listNotes(): Promise<string[]> {
  return [...notes];
}

export async function addNote(form: FormData): Promise<{ error: string }> {
  const text = String(form.get('text') ?? '').trim();
  if (!text) {
    return { error: 'Write a note' };
  }
  notes.push(text);
  return { error: '' };
}
