declare module '*.brm?brumate-server' {
  import type { Context } from 'brumate/server';

  const Component: (props: any, ctx: Context) => Promise<string>;
  export default Component;
}

declare module 'virtual:brumate/testing' {
  export const mount: import('brumate/testing').Mount;
}

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

declare module 'virtual:brumate/routes' {
  export const routes: import('brumate/server').RouteNode;
  export function handle(
    request: Request,
    options?: import('brumate/server').DocumentOptions,
  ): Promise<Response | undefined>;
}
