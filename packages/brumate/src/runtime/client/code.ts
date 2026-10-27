// Loads the code of components: their modules, their parts, and the components of the page.

import type { Handler } from './references.ts';
import { loadedParts, loading, modules, options, partOf, parts, valueRenders } from './state.ts';
import type { ClientModule, Part } from './state.ts';

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

export function loadPart(module: ClientModule, name: string): Promise<Part> {
  const key = `${module.id}:${name}`;
  let promise = parts.get(key);
  if (!promise) {
    let loaded: Promise<Part>;
    if (!module.load) {
      loaded = Promise.resolve(module as unknown as Part);
    } else {
      loaded = options.loadPart ? options.loadPart(module, name) : module.load(name);
    }
    promise = loaded.then((part) => {
      loadedParts.set(key, part);
      return part;
    });
    parts.set(key, promise);
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
    .finally(() => loadingCode.delete(code));
  loadingCode.add(code);
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
  // A module without `load` holds every part itself.
  const part = module.load ? loadedParts.get(`${id}:${partOf(name)}`) : (module as unknown as Part);
  return part?.[name] as Handler | undefined;
}
