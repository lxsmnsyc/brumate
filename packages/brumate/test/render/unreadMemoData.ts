export function fail(): Promise<string> {
  return new Promise((_done, reject) => setTimeout(() => reject(new Error('side failed')), 10));
}
