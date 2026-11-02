// The features of the core that a compiled component uses. The Vite plugin turns off, in the
// client build of an app, the features that none of its components use. See
// `runtime/features.ts`.
import type { CompileResult } from './compile.ts';

export interface Features {
  /** Children that the browser renders with an export of their own. */
  children: boolean;
  /** `#template` values that the browser calls. */
  templates: boolean;
  /** `<title>` elements in markup. */
  titles: boolean;
  /** `$bind` that a component passes to another. */
  bindings: boolean;
  /** Markup that comes after the page: `#loading`, `#defer` and lists that stream. */
  lateMarkup: boolean;
  /** `$client` callbacks and `#defer` blocks. */
  blocks: boolean;
  /** Handlers of the window or the document. */
  listeners: boolean;
  /** Forms of an `$action`. */
  actions: boolean;
  /** Markup that the browser renders as HTML, not as a clone of a template. */
  clientHTML: boolean;
  /** `#try` blocks, whose `#catch` the browser renders. */
  tries: boolean;
  /** Fields of an element `$bind`, which the core reads when the user typed before it loaded. */
  fields: boolean;
  /** `#for` lists with `window`. */
  windows: boolean;
  /** Dynamic tags, which can name a component and pass it props. */
  dynamic: boolean;
  /** `$route` and `$navigation`, which the runtime provides. */
  routes: boolean;
}

/** No feature at all, which a build that has no component uses. */
export function noFeatures(): Features {
  return {
    children: false,
    templates: false,
    titles: false,
    bindings: false,
    lateMarkup: false,
    blocks: false,
    listeners: false,
    actions: false,
    clientHTML: false,
    tries: false,
    fields: false,
    windows: false,
    dynamic: false,
    routes: false,
  };
}

/** Every feature, for a build that compiles components in the browser. */
export function allFeatures(): Features {
  const all = noFeatures();
  for (const name of Object.keys(all) as (keyof Features)[]) {
    all[name] = true;
  }
  return all;
}

/** The features of the core that a compiled component uses. */
export function getFeatures(result: CompileResult): Features {
  const client = [result.client, result.render, ...Object.values(result.parts)].join('\n');
  // A `#client` body has no markup on the server, so its titles, listeners and forms are only in
  // the code of the browser.
  const all = `${result.server}\n${client}`;
  return {
    // The server sends a reference to the export that renders them, or the browser makes them.
    children: result.plan.childrenRenders.size > 0 || /\$\$b\.children\(/.test(client),
    // A template that the browser can call has an export of its own, `t` and a number.
    templates: /\bexport (?:const|function) t\d+\b/.test(client),
    titles: /\bb-t\b/.test(all),
    bindings: /\$\$b\.binding\(/.test(all),
    lateMarkup: /\$\$ctx\.(?:boundary|defer|deferBlock)\(|\bgather\(/.test(result.server),
    blocks: /\bb-(?:client|defer)\b/.test(all),
    listeners: /\bb-listen\b/.test(all),
    actions: /\$\$b\.action\(/.test(all),
    // A render function that gives HTML. One with no markup gives an empty string.
    clientHTML: /\breturn \$\$html;/.test(client),
    tries: /\$\$b\.caught\(/.test(result.server) || /\bexport const t = /.test(client),
    // A `$bind` that a component passes on can reach an element through a spread, whose `b-on`
    // entry the server writes at run time, so a passed binding counts too.
    fields: /=\$bind#|=\$set:|\$\$b\.binding\(/.test(all),
    windows: /\$\$b\.windowList\(/.test(client),
    dynamic: /\$\$b\.dynamic(?:Nodes)?\(/.test(client),
    // `$route` compiles to `$$b.routeContext`; `brumate/context` exports the contexts too.
    routes: /\b(?:routeContext|navigationContext)\b/.test(all),
  };
}

/** The features of several components together. */
export function joinFeatures(all: Features[]): Features {
  const joined = noFeatures();
  for (const features of all) {
    joined.children ||= features.children;
    joined.templates ||= features.templates;
    joined.titles ||= features.titles;
    joined.bindings ||= features.bindings;
    joined.lateMarkup ||= features.lateMarkup;
    joined.blocks ||= features.blocks;
    joined.listeners ||= features.listeners;
    joined.actions ||= features.actions;
    joined.clientHTML ||= features.clientHTML;
    joined.tries ||= features.tries;
    joined.fields ||= features.fields;
    joined.windows ||= features.windows;
    joined.dynamic ||= features.dynamic;
    joined.routes ||= features.routes;
  }
  return joined;
}

/** The names of the globals of `runtime/features.ts`, by feature. */
const GLOBALS: Record<keyof Features, string> = {
  children: '__BRUMATE_HAS_CHILDREN__',
  templates: '__BRUMATE_HAS_TEMPLATES__',
  titles: '__BRUMATE_HAS_TITLES__',
  bindings: '__BRUMATE_HAS_BINDINGS__',
  lateMarkup: '__BRUMATE_HAS_LATE_MARKUP__',
  blocks: '__BRUMATE_HAS_BLOCKS__',
  listeners: '__BRUMATE_HAS_LISTENERS__',
  actions: '__BRUMATE_HAS_ACTIONS__',
  clientHTML: '__BRUMATE_HAS_CLIENT_HTML__',
  tries: '__BRUMATE_HAS_TRIES__',
  fields: '__BRUMATE_HAS_FIELDS__',
  windows: '__BRUMATE_HAS_WINDOWS__',
  dynamic: '__BRUMATE_HAS_DYNAMIC__',
  routes: '__BRUMATE_HAS_ROUTES__',
};

/** True for code that reads a feature, such as the core. */
export function readsFeatures(code: string): boolean {
  return code.includes('__BRUMATE_HAS_');
}

/** The code with each feature written in as `true` or `false`. */
export function writeFeatures(code: string, features: Features): string {
  let result = code;
  for (const [name, global] of Object.entries(GLOBALS)) {
    // The TypeScript source declares each global, and the declaration stays.
    result = result.replace(
      new RegExp(`(?<!declare const )\\b${global}\\b`, 'g'),
      String(features[name as keyof Features]),
    );
  }
  return result;
}
