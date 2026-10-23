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
  /**
   * The custom property for each `${…}` interpolation, in source order. Text
   * right before or after it, such as a unit in `${size}px`, is part of the
   * value, because `var(--x)px` is not valid CSS.
   */
  variables: { name: string; expression: Expression; prefix: string; suffix: string }[];
  diagnostics: Diagnostic[];
  /** Absolute paths of the files that SCSS or Less imported. */
  dependencies: string[];
  /**
   * The compound selectors that got the scope attribute, by what an element
   * needs to match one. See `needsScope`.
   */
  targets: ScopeTarget[];
}

/**
 * What a scoped compound selector needs of an element: its tag, in lower
 * case, and its classes. A compound without either can match any element.
 */
export interface ScopeTarget {
  tag?: string;
  classes: string[];
}

/**
 * True if a scoped selector could match an element, so the element needs the
 * scope attribute. `tag` is undefined when it is not known at compile time,
 * and `classes` is undefined when the element can have classes that are not
 * known.
 */
export function needsScope(
  targets: ScopeTarget[],
  tag: string | undefined,
  classes: string[] | undefined,
): boolean {
  const lower = tag?.toLowerCase();
  return targets.some(
    (target) =>
      (target.tag === undefined || lower === undefined || target.tag === lower) &&
      (classes === undefined || target.classes.every((name) => classes.includes(name))),
  );
}

/** What an element needs to match a compound. Selectors inside pseudo-classes are not read. */
function scopeTarget(compound: SelectorPart[]): ScopeTarget {
  const target: ScopeTarget = { classes: [] };
  for (const node of compound) {
    if (node.type === 'tag') {
      target.tag = node.value.toLowerCase();
    } else if (node.type === 'class') {
      target.classes.push(node.value);
    }
  }
  return target;
}

type SelectorPart = Parameters<Parameters<selectorParser.Selector['each']>[0]>[0];

/**
 * Adds the scope attribute to every compound selector, except inside
 * `:global(…)`. Each scoped compound goes into `targets`.
 */
const scopeSelector = (attribute: string, targets: ScopeTarget[]) =>
  selectorParser((selectors) => {
    // `:global(h1, h2)` is a list: the selector around it becomes one selector for each item.
    for (let index = 0; index < selectors.nodes.length; index++) {
      const selector = selectors.nodes[index]!;
      let list: selectorParser.Pseudo | undefined;
      selector.walkPseudos((pseudo) => {
        if (!list && pseudo.value === ':global' && pseudo.nodes.length > 1) {
          list = pseudo;
        }
      });
      if (!list) {
        continue;
      }
      const items = list.nodes;
      const copies = items.map((_, item) => {
        const copy = selector.clone() as selectorParser.Selector;
        let found: selectorParser.Pseudo | undefined;
        copy.walkPseudos((pseudo) => {
          if (!found && pseudo.value === ':global' && pseudo.nodes.length > 1) {
            found = pseudo;
          }
        });
        const only = found!.nodes[item]!;
        // The space after the comma of the list.
        if (only.first) {
          only.first.spaces.before = '';
        }
        found!.nodes = [only];
        return copy;
      });
      selector.replaceWith(...copies);
      // The copies can hold another list, so they are looked at again.
      index--;
    }
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
        targets.push(scopeTarget(compound));
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

function scopeRules(root: Root, attribute: string, targets: ScopeTarget[]): void {
  const processor = scopeSelector(attribute, targets);
  root.walkRules((rule) => {
    // Keyframe steps such as `from` and `50%` are not selectors.
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test((rule.parent as AtRule).name)) {
      return;
    }
    rule.selector = processor.processSync(rule.selector);
  });
}

/** Line breaks in a selector, value or at-rule are whitespace, because strings cannot hold them. */
function collapse(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ').trim();
}

/**
 * Removes the comments and the whitespace that CSS does not need, for a
 * build. Comments that start with `/*!`, such as licenses, stay.
 */
export function minifyCSS(css: string): string {
  if (!css) {
    return css;
  }
  const root = parse(css);
  root.raws.after = '';
  root.raws.semicolon = false;
  root.walk((node) => {
    node.raws.before = '';
    switch (node.type) {
      case 'comment':
        if (!node.text.startsWith('!')) {
          node.remove();
        }
        break;
      case 'decl':
        node.raws.between = ':';
        // The raw value holds comments.
        delete node.raws.value;
        node.value = collapse(node.value);
        if (node.important) {
          node.raws.important = '!important';
        }
        break;
      case 'rule':
        delete node.raws.selector;
        node.selector = collapse(node.selector);
        node.raws.between = '';
        node.raws.after = '';
        node.raws.semicolon = false;
        break;
      case 'atrule':
        delete node.raws.params;
        node.params = collapse(node.params);
        node.raws.afterName = node.params ? ' ' : '';
        node.raws.between = '';
        node.raws.after = '';
        node.raws.semicolon = false;
        break;
    }
  });
  return root.toString();
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
  const targets: ScopeTarget[] = [];
  for (const style of file.styles) {
    // Interpolations become custom properties. Offsets in `content` start after `<style>`.
    const contentStart = file.source.indexOf(style.content, style.start);
    let content = '';
    let position = 0;
    for (const expression of style.variables) {
      const name = `--${attribute}-${variables.length}`;
      let start = expression.start - 2 - contentStart;
      let end = expression.end + 1 - contentStart;
      // Text that touches the interpolation, such as `px` or `#`, goes into the value.
      const prefixStart = start;
      while (start > position && /[#\w.%-]/.test(style.content[start - 1]!)) {
        start--;
      }
      const prefix = style.content.slice(start, prefixStart);
      const suffixStart = end;
      while (end < style.content.length && /[\w.%-]/.test(style.content[end]!)) {
        end++;
      }
      const suffix = style.content.slice(suffixStart, end);
      variables.push({ name, expression, prefix, suffix });
      content += `${style.content.slice(position, start)}var(${name})`;
      position = end;
    }
    content += style.content.slice(position);
    try {
      const root = parse(
        style.lang === 'css' ? content : preprocess(style.lang, content, filePath, dependencies),
      );
      scopeRules(root, attribute, targets);
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
  return { css: parts.join('\n'), attribute, variables, diagnostics, dependencies, targets };
}
