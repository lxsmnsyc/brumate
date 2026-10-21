// Type-checked with the package. It fails to compile if `href` does not check paths and params.
import { href } from '../src/runtime/routes.ts';
import type { RouteParams } from '../src/runtime/routes.ts';

declare module '../src/runtime/routes.ts' {
  interface Routes {
    '/': {};
    '/todos/[id]': { id: string };
  }
}

href('/');
href('/todos/[id]', { id: '3' });
const params: RouteParams<'/todos/[id]'> = { id: '3' };
href('/todos/[id]', params);
// @ts-expect-error A path that no route has.
href('/missing');
// @ts-expect-error The params of a path with params are needed.
href('/todos/[id]');
// @ts-expect-error A param of another name.
href('/todos/[id]', { name: '3' });
