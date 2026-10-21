// Written by the brumate Vite plugin from the route files. Do not edit.
export {};

declare module 'brumate/routes' {
  interface Routes {
    '/': {};
    '/[...rest]': { rest: string };
    '/api/hello': {};
    '/counter/[start]': { start: string };
    '/guestbook': {};
  }
}
