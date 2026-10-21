'use server';

// Server functions of the kit. They run on the server of the app that uses
// the kit, and the browser gets a stub for each.

/** A greeting for a name, made on the server. */
export async function greet(name: string): Promise<string> {
  return `Hello, ${name}, from the server`;
}
