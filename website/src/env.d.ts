/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The address of the site without a trailing slash, such as `https://brumate.dev`. */
  readonly SITE_URL: string;
}

declare module '*.brm?inspect' {
  import type { Raw } from 'brumate/html';

  export const source: Raw;
  export const client: Raw;
  export const css: Raw;
  /** The markup that the server renders for the component, one tag on a line. */
  export const html: Raw;
  /** The script of the page state that the server sends with the markup. */
  export const state: Raw;
  export const text: Raw;
  export const report: {
    name: string;
    roots: { label: string; reason: string }[];
    changes: { label: string; reason: string }[];
    state: { scope: string; slots: string[] }[];
    staticMarkup: { elements: number; inserts: number };
    sizes: { module: string; bytes: number; gzip: number }[];
    scope: string | null;
  };
}

declare module '*.md' {
  import type { Page } from './docs.ts';

  const page: Page;
  export default page;
}

declare module 'virtual:search-index' {
  export const index: {
    page: string;
    pageTitle: string;
    heading: string;
    id: string;
    text: string;
  }[];
}

declare module 'virtual:ui-search-index' {
  export const index: {
    page: string;
    pageTitle: string;
    heading: string;
    id: string;
    text: string;
  }[];
}
