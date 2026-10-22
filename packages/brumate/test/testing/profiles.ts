'use server';

export async function getProfiles(ids: string[]): Promise<Record<string, string>> {
  return Object.fromEntries(ids.map((id) => [id, `Player ${id}`]));
}
