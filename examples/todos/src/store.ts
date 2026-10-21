'use server';

// A file of server functions. Each export runs only on the server, and the
// browser gets a stub that calls it, so this file never ships.

export interface Todo {
  id: string;
  title: string;
  done: boolean;
}

export async function save(list: Todo[]): Promise<void> {
  console.log('Saved', list.length, 'todos');
}
