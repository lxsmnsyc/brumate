export function gapLoad(_step = 0): Promise<string> {
  return new Promise((done) => setTimeout(() => done('gap ok'), 10));
}
export function gapNow(): Promise<string> {
  return Promise.resolve('gap ok');
}
export function gapFail(): Promise<string> {
  return new Promise((_done, reject) => setTimeout(() => reject(new Error('gap failed')), 10));
}
