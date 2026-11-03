// Loads a user after a delay, and counts the loads, so the test sees each load once.
export function load(id: number): Promise<{ name: string }> {
  const counts = ((globalThis as { loads?: number[] }).loads ??= []);
  counts.push(id);
  return new Promise((done) => setTimeout(() => done({ name: `ada${id}` }), 150));
}
