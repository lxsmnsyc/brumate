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
}

/** No feature at all, which a build that has no component uses. */
export function noFeatures(): Features {
  return { children: false, templates: false, titles: false, bindings: false };
}

/** The features of the core that a compiled component uses. */
export function featuresOf(result: CompileResult): Features {
  const client = [result.client, result.render, ...Object.values(result.parts)].join('\n');
  return {
    // The server sends a reference to the export that renders them, or the browser makes them.
    children: result.plan.childrenRenders.size > 0 || /\$\$b\.children\(/.test(client),
    // A template that the browser can call has an export of its own, `t` and a number.
    templates: /\bexport (?:const|function) t\d+\b/.test(client),
    titles: /\bb-t\b/.test(result.server),
    bindings: /\$\$b\.binding\(/.test(`${result.server}\n${client}`),
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
  }
  return joined;
}

/** The names of the globals of `runtime/features.ts`, by feature. */
const GLOBALS: Record<keyof Features, string> = {
  children: '__BRUMATE_HAS_CHILDREN__',
  templates: '__BRUMATE_HAS_TEMPLATES__',
  titles: '__BRUMATE_HAS_TITLES__',
  bindings: '__BRUMATE_HAS_BINDINGS__',
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
