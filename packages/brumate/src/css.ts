import { builtin } from './node.ts';
import { parse } from 'postcss';
import type { AtRule, Root } from 'postcss';
import selectorParser from 'postcss-selector-parser';
import type { Expression, SFCFile } from './ast.ts';
import type { Diagnostic } from './model.ts';

export interface StyleOutput {
  /** The scoped CSS of every `<style>` block, or an empty string. */
  css: string;
  /** The attribute that marks the component's elements, such as `s-1abc`. */
  attribute: string;
  /** The custom property for each `${…}` interpolation, in source order. */
  variables: { name: string; expression: Expression }[];
  diagnostics: Diagnostic[];
  /** Absolute paths of the files that SCSS or Less imported. */
  dependencies: string[];
}

type SelectorPart = Parameters<Parameters<selectorParser.Selector['each']>[0]>[0];

/** Adds the scope attribute to every compound selector, except inside `:global(…)`. */
const scopeSelector = (attribute: string) =>
  selectorParser((selectors) => {
    selectors.each((selector) => {
      // Split the selector into compounds at combinators.
      const compounds: SelectorPart[][] = [[]];
      selector.each((node) => {
        if (node.type === 'combinator') {
          compounds.push([]);
        } else {
          compounds.at(-1)!.push(node);
        }
      });
      for (const compound of compounds) {
        const global = compound.find(
          (node): node is selectorParser.Pseudo =>
            node.type === 'pseudo' && node.value === ':global',
        );
        if (global) {
          // `:global(.a)` becomes `.a`, without the scope.
          const inner = global.nodes[0]?.nodes ?? [];
          global.replaceWith(...inner.map((node) => node.clone()));
          continue;
        }
        if (compound.length === 0) {
          continue;
        }
        // The attribute goes before pseudo-elements such as `::before`.
        const last = compound.findLast(
          (node) => !(node.type === 'pseudo' && node.value.startsWith('::')),
        );
        const scope = selectorParser.attribute({ attribute, value: undefined, raws: {} } as never);
        if (last) {
          selector.insertAfter(last, scope);
        } else {
          selector.insertBefore(compound[0]!, scope);
        }
      }
    });
  });

function scopeRules(root: Root, attribute: string): void {
  const processor = scopeSelector(attribute);
  root.walkRules((rule) => {
    // Keyframe steps such as `from` and `50%` are not selectors.
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test((rule.parent as AtRule).name)) {
      return;
    }
    rule.selector = processor.processSync(rule.selector);
  });
}

/**
 * Loads a style preprocessor from the project, or from beside this package.
 * Returns undefined when it is not installed.
 */
function loadPreprocessor<T>(name: string): T | undefined {
  const module = builtin('node:module');
  const path = builtin('node:path');
  if (!module || !path) {
    // In a browser, preprocessors are not available.
    return undefined;
  }
  for (const base of [path.join(process.cwd(), 'package.json'), import.meta.url]) {
    try {
      return module.createRequire(base)(name) as T;
    } catch {
      // Not installed here.
    }
  }
  return undefined;
}

interface Sass {
  compileString(
    source: string,
    options: { syntax: 'scss'; url?: URL },
  ): { css: string; loadedUrls: URL[] };
}

interface Less {
  render(
    source: string,
    options: { syncImport: boolean; filename?: string },
    callback: (
      error: Error | undefined,
      output: { css: string; imports: string[] } | undefined,
    ) => void,
  ): void;
}

/**
 * Turns SCSS or Less into CSS. `file` is the absolute path of the component,
 * for imports of files next to it. Throws with a message when it cannot.
 */
function preprocess(
  lang: 'scss' | 'less',
  source: string,
  file: string | undefined,
  dependencies: string[],
): string {
  if (lang === 'scss') {
    const sass = loadPreprocessor<Sass>('sass');
    if (!sass) {
      throw new Error('<style lang="scss"> needs the sass package. Install it in the project');
    }
    const url = builtin('node:url')!;
    const result = sass.compileString(source, {
      syntax: 'scss',
      url: file ? url.pathToFileURL(file) : undefined,
    });
    for (const loaded of result.loadedUrls) {
      if (loaded.protocol === 'file:' && url.fileURLToPath(loaded) !== file) {
        dependencies.push(url.fileURLToPath(loaded));
      }
    }
    return result.css;
  }
  const less = loadPreprocessor<Less>('less');
  if (!less) {
    throw new Error('<style lang="less"> needs the less package. Install it in the project');
  }
  let css: string | undefined;
  let failure: Error | undefined;
  // Less calls back before render returns when nothing is imported.
  less.render(source, { syncImport: true, filename: file }, (error, output) => {
    failure = error;
    css = output?.css;
    dependencies.push(...(output?.imports ?? []));
  });
  if (failure) {
    throw failure;
  }
  if (css === undefined) {
    throw new Error('Less did not finish. Imports that load over the network are not supported');
  }
  return css;
}

/** Compiles the `<style>` blocks of a file into scoped CSS. */
export function compileStyles(file: SFCFile, scope: string, filePath?: string): StyleOutput {
  const attribute = `s-${scope}`;
  const diagnostics: Diagnostic[] = [];
  const variables: StyleOutput['variables'] = [];
  const dependencies: string[] = [];
  const parts: string[] = [];
  for (const style of file.styles) {
    // Interpolations become custom properties. Offsets in `content` start after `<style>`.
    const contentStart = file.source.indexOf(style.content, style.start);
    let content = '';
    let position = 0;
    for (const expression of style.variables) {
      const name = `--${attribute}-${variables.length}`;
      variables.push({ name, expression });
      const start = expression.start - 2 - contentStart;
      const end = expression.end + 1 - contentStart;
      content += `${style.content.slice(position, start)}var(${name})`;
      position = end;
    }
    content += style.content.slice(position);
    try {
      const root = parse(
        style.lang === 'css' ? content : preprocess(style.lang, content, filePath, dependencies),
      );
      scopeRules(root, attribute);
      parts.push(root.toString().trim());
    } catch (error) {
      diagnostics.push({
        severity: 'error',
        message:
          style.lang === 'css'
            ? `Invalid CSS: ${(error as Error).message}`
            : (error as Error).message,
        range: { start: style.start, end: style.end },
      });
    }
  }
  return { css: parts.join('\n'), attribute, variables, diagnostics, dependencies };
}
