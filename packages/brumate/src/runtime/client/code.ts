// Loads the code of components: their modules and the components of the page.

import type { Handler } from './references.ts';
import { loading, modules, options, valueRenders } from './state.ts';
import type { ClientModule, Scope } from './state.ts';

export function loadModule(id: string): Promise<ClientModule> {
  let promise = loading.get(id);
  if (!promise) {
    // A component without client code has nothing to update.
    promise = Promise.resolve(options.load(id)).then((loaded) => {
      const module = loaded ?? { id, props: {}, g: {} };
      modules.set(id, module);
      for (const render of module.components ?? []) {
        valueRenders[render.brumateId] = render;
      }
      return module;
    });
    loading.set(id, promise);
  }
  return promise;
}

/** True for a reference to a `#template` that a component got as a prop, such as `Page#t3`. */
export function isTemplate(ref: string): boolean {
  return /#t\d/.test(ref);
}

/**
 * The code of the components on the page that is still loading. Handlers, updates and calls of
 * functions of other components wait for it, so the code that they call has loaded.
 */
export const loadingCode: Set<Promise<unknown>> = new Set();

/** The same loads as `loadingCode`, by the ID of the component. */
const loadingComponents = new Map<string, Promise<unknown>>();

/** The components whose code loads, or has loaded, with the page. */
export const pageComponents: Set<string> = new Set();

/** Loads the code of a component and all of its parts, as the page reads its scopes. */
export function loadComponent(id: string): void {
  // A render module that runs before the core starts, such as in a test, has nothing to load.
  if (options === undefined || pageComponents.has(id)) {
    return;
  }
  pageComponents.add(id);
  // The entry of a component holds all of its code. A load that fails is reported when a
  // handler or an update needs it.
  const code: Promise<unknown> = loadModule(id)
    .catch(() => {})
    .finally(() => {
      loadingCode.delete(code);
      loadingComponents.delete(id);
    });
  loadingCode.add(code);
  loadingComponents.set(id, code);
}

/**
 * The code that still loads for the components at a scope and above it. An update of the scope
 * renders the templates and calls the function props of those components, never the code of a
 * component below it, so a layout that stays updates while the code of a new page loads.
 *
 * The walk is the one of contexts. Children that a component C inserted go to C through `t`,
 * and C goes to the parent P that wrote the children through `o`, so the code of P, which
 * the templates and function props of the children come from, is on the walk too.
 */
export function codeAbove(scope: Scope): Promise<unknown>[] {
  const waits: Promise<unknown>[] = [];
  if (loadingComponents.size === 0) {
    return waits;
  }
  for (
    let current: Scope | undefined = scope;
    current;
    current = current.t ?? current.p ?? current.o
  ) {
    const code = current.m === undefined ? undefined : loadingComponents.get(current.m);
    if (code) {
      waits.push(code);
    }
  }
  return waits;
}

/** Resolves when the code of the components on the page has loaded. */
export function codeReady(): Promise<unknown> | undefined {
  return loadingCode.size > 0 ? Promise.allSettled(loadingCode) : undefined;
}

/** The function of a reference, such as `Page#h3`, once its code has loaded. */
export function loadedFunction(ref: string): Handler | undefined {
  const [id, name] = ref.split('#') as [string, string];
  const module = modules.get(id);
  if (!module) {
    return undefined;
  }
  return (module as unknown as Record<string, Handler | undefined>)[name];
}
