export function gapLoad(_step = 0): Promise<string> {
  return new Promise((done) => setTimeout(() => done('gap ok'), 10));
}
export function gapNow(): Promise<string> {
  return Promise.resolve('gap ok');
}
export function gapFail(): Promise<string> {
  return new Promise((_done, reject) => setTimeout(() => reject(new Error('gap failed')), 10));
}
export function gapNever(): Promise<string> {
  return new Promise(() => {});
}
export interface GapUser {
  admin: boolean;
  name: string;
}
export function gapUser(): Promise<GapUser> {
  return new Promise((done) => setTimeout(() => done({ admin: true, name: 'Ada' }), 10));
}
export function gapItems(): Promise<string[]> {
  return new Promise((done) => setTimeout(() => done(['a', 'b']), 10));
}
export function gapUserFail(): Promise<GapUser> {
  return new Promise((_done, reject) => setTimeout(() => reject(new Error('gap failed')), 10));
}
export function gapNone(): Promise<GapUser | null> {
  return new Promise((done) => setTimeout(() => done(null), 10));
}
