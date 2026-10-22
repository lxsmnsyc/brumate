declare module '*.brm?brumate-server' {
  import type { Context } from 'brumate/server';

  const Component: (props: any, ctx: Context) => Promise<string>;
  export default Component;
}

declare module 'virtual:brumate/testing' {
  export const mount: import('brumate/testing').Mount;
  /**
   * Answers the server function calls of the page with the server code of
   * the app, until the returned function restores `fetch`.
   */
  export function answerCalls(options?: import('brumate/testing').AnswerOptions): () => void;
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
  export function handle(
    request: Request,
    options?: import('brumate/server').RequestOptions,
  ): Promise<Response | undefined>;
}

declare module 'virtual:brumate/routes' {
  export const routes: import('brumate/server').RouteNode;
  export function handle(
    request: Request,
    options?: import('brumate/server').DocumentOptions,
  ): Promise<Response | undefined>;
}
