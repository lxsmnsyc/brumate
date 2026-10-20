declare module '*.brm' {
  import type { Context } from 'brumate/server';

  const Component: (props: any, ctx: Context) => Promise<string>;
  export default Component;
}

declare module 'virtual:brumate/start' {}

declare module 'virtual:brumate/manifest' {
  export function load(id: string): Promise<import('brumate/client').ClientModule>;
}

declare module 'virtual:brumate/server' {
  export const functions: Record<string, (...args: any[]) => unknown>;
  export function handle(request: Request): Promise<Response | undefined>;
}
