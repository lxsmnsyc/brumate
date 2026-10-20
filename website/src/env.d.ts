/// <reference types="vite/client" />

declare module '*.brm?inspect' {
  import type { Raw } from 'brumate/html';

  export const source: Raw;
  export const report: {
    name: string;
    roots: { label: string; reason: string }[];
    changes: { label: string; reason: string }[];
    state: { scope: string; slots: string[] }[];
    staticMarkup: { elements: number; inserts: number };
    sizes: { module: string; bytes: number; gzip: number }[];
  };
}

declare module '*.md' {
  import type { Page } from './docs.ts';

  const page: Page;
  export default page;
}
