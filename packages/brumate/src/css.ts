import { builtin } from './node.ts';
import { parse } from 'postcss';
import type { AtRule, Root } from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { bodyTree } from './ast.ts';
import type { Body, BodyInfo, Expression, SFCFile, Style } from './ast.ts';
import type { Diagnostic } from './model.ts';

export interface StyleOutput {
  /**
   * The CSS of every `<style>` block, the component's and then those of the blocks, scoped
   * except `<style global>`, or an empty string.
   */
  css: string;
  /** True if the `<style>` of the component itself has CSS, so its elements get `attribute`. */
  hasComponentCss: boolean;
  /** The attribute that marks the component's elements, such as `b-c-1abc`. */
  attribute: string;
  /**
   * The custom property for each `${…}` interpolation, in source order. Text
   * right before or after it, such as a unit in `${size}px`, is part of the
   * value, because `var(--x)px` is not valid CSS.
   */
  variables: StyleVariable[];
  diagnostics: Diagnostic[];
  /** Absolute paths of the files that SCSS or Less imported. */
  dependencies: string[];
  /**
   * The compound selectors that got the scope attribute, by what an element
   * needs to match one. See `needsScope`.
   */
  targets: ScopeTarget[];
  /**
   * The `<style>` of the block bodies, one entry for each body that has any, in source order.
   * Their rules follow those of the component in `css`, outer blocks first.
   */
  blocks: BlockStyle[];
  /**
   * What each body of the file takes from `blocks`. Bodies that take nothing are not in it,
   * and it is empty when no block has a style.
   */
  bodies: Map<Body, BodyStyles>;
}

export interface StyleVariable {
  name: string;
  expression: Expression;
  prefix: string;
  suffix: string;
}

/** The `<style>` of one block body. */
export interface BlockStyle {
  body: Body;
  /** The attribute that marks the elements its rules reach, such as `b-c-1abc-1`. */
  attribute: string;
  /** Its `${…}` interpolations, named `--s-<hash>-<n>-<index>`. */
  variables: StyleVariable[];
  targets: ScopeTarget[];
}

export interface BodyStyles {
  /**
   * The block styles whose rules reach the elements of the body: its own and those of the bodies
   * around it, outermost first. Its elements get their attributes.
   */
  attributes: BlockStyle[];
  /**
   * The block styles whose variables go on the top-level elements of the body: its own, and
   * those of the bodies around it that it sits at the top level of, outermost first. Elements
   * deeper in the body inherit the variables.
   */
  variables: BlockStyle[];
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
  for (const target of targets) {
    if (target.tag !== undefined && lower !== undefined && target.tag !== lower) {
      continue;
    }
    if (classes === undefined) {
      return true;
    }
    let hasClasses = true;
    for (const name of target.classes) {
      if (!classes.includes(name)) {
        hasClasses = false;
        break;
      }
    }
    if (hasClasses) {
      return true;
    }
  }
  return false;
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
 * `:global(…)`. Each scoped compound goes into `targets`. With `unscoped`, no
 * compound is scoped, and `:global(…)` is only unwrapped.
 */
function scopeSelector(attribute: string, targets: ScopeTarget[], unscoped: boolean) {
  return selectorParser((selectors) => {
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
      const copies: selectorParser.Selector[] = [];
      for (let item = 0; item < items.length; item++) {
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
        copies.push(copy);
      }
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
        let global: selectorParser.Pseudo | undefined;
        for (const node of compound) {
          if (node.type === 'pseudo' && node.value === ':global') {
            global = node;
            break;
          }
        }
        if (global) {
          // `:global(.a)` becomes `.a`, without the scope.
          const inner = global.nodes[0]?.nodes ?? [];
          const clones: selectorParser.Node[] = [];
          for (const node of inner) {
            clones.push(node.clone());
          }
          global.replaceWith(...clones);
          continue;
        }
        if (compound.length === 0 || unscoped) {
          continue;
        }
        targets.push(scopeTarget(compound));
        // The attribute goes before pseudo-elements such as `::before`.
        let last: SelectorPart | undefined;
        for (let at = compound.length - 1; at >= 0; at--) {
          const node = compound[at]!;
          if (!(node.type === 'pseudo' && node.value.startsWith('::'))) {
            last = node;
            break;
          }
        }
        const scope = selectorParser.attribute({ attribute, value: undefined, raws: {} } as never);
        if (last) {
          selector.insertAfter(last, scope);
        } else {
          selector.insertBefore(compound[0]!, scope);
        }
      }
    });
  });
}

function scopeRules(
  root: Root,
  attribute: string,
  targets: ScopeTarget[],
  unscoped: boolean,
): void {
  const processor = scopeSelector(attribute, targets, unscoped);
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

const GLOBAL_IN_BLOCK =
  ':global(…) is not allowed in the <style> of a block. Put global rules in the <style> of the file';

/** What `compileStyle` adds to as it goes. */
interface StyleState {
  filePath: string | undefined;
  diagnostics: Diagnostic[];
  dependencies: string[];
  variables: StyleVariable[];
  targets: ScopeTarget[];
}

/**
 * Compiles one `<style>` into scoped CSS, and adds its interpolations to `state.variables`.
 * `name` makes the name of a custom property from its index. Returns undefined after an error.
 */
function compileStyle(
  file: SFCFile,
  style: Style,
  attribute: string,
  name: (index: number) => string,
  state: StyleState,
  inBlock: boolean,
): string | undefined {
  const { variables } = state;
  // Interpolations become custom properties. Offsets in `content` start after `<style>`.
  const contentStart = file.source.indexOf(style.content, style.start);
  let content = '';
  let position = 0;
  for (const expression of style.variables) {
    const variable = name(variables.length);
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
    variables.push({ name: variable, expression, prefix, suffix });
    content += `${style.content.slice(position, start)}var(${variable})`;
    position = end;
  }
  content += style.content.slice(position);
  try {
    const root = parse(
      style.lang === 'css'
        ? content
        : preprocess(style.lang, content, state.filePath, state.dependencies),
    );
    if (inBlock) {
      let global = false;
      root.walkRules((rule) => {
        global ||= /:global\b/.test(rule.selector);
      });
      if (global) {
        state.diagnostics.push({
          severity: 'error',
          message: GLOBAL_IN_BLOCK,
          range: { start: style.start, end: style.end },
        });
        return undefined;
      }
    }
    scopeRules(root, attribute, state.targets, style.global);
    return root.toString().trim();
  } catch (error) {
    state.diagnostics.push({
      severity: 'error',
      message:
        style.lang === 'css'
          ? `Invalid CSS: ${(error as Error).message}`
          : (error as Error).message,
      range: { start: style.start, end: style.end },
    });
    return undefined;
  }
}

/**
 * What each body takes from the block styles around it. See `BodyStyles`. A body that no block
 * style reaches is left out.
 */
function bodyStyles(file: SFCFile, blocks: BlockStyle[]): Map<Body, BodyStyles> {
  const result = new Map<Body, BodyStyles>();
  if (blocks.length === 0) {
    return result;
  }
  const byBody = new Map<Body, BlockStyle>();
  for (const block of blocks) {
    byBody.set(block.body, block);
  }
  const tree = bodyTree(file);
  for (const body of tree.keys()) {
    const attributes: BlockStyle[] = [];
    const variables: BlockStyle[] = [];
    let atTop = true;
    let current: Body | undefined = body;
    while (current) {
      const block = byBody.get(current);
      if (block) {
        attributes.unshift(block);
        if (atTop && block.variables.length > 0) {
          variables.unshift(block);
        }
      }
      const info: BodyInfo = tree.get(current)!;
      atTop = atTop && info.top;
      current = info.parent;
    }
    if (attributes.length > 0) {
      result.set(body, { attributes, variables });
    }
  }
  return result;
}

/**
 * Compiles the `<style>` blocks of a file into scoped CSS: the styles of the component, and then
 * those of the block bodies, each with its own attribute.
 */
export function compileStyles(file: SFCFile, scope: string, filePath?: string): StyleOutput {
  // Under `b-`, which the compiler reserves, so markup and data cannot write it.
  const attribute = `b-c-${scope}`;
  const state: StyleState = {
    filePath,
    diagnostics: [],
    dependencies: [],
    variables: [],
    targets: [],
  };
  const parts: string[] = [];
  for (const style of file.styles) {
    const css = compileStyle(
      file,
      style,
      attribute,
      (index) => `--s-${scope}-${index}`,
      state,
      false,
    );
    if (css !== undefined) {
      parts.push(css);
    }
  }
  const hasComponentCss = parts.join('\n') !== '';
  // A body comes after the body around it, so its rules win at the same specificity.
  const bodies: Body[] = [];
  if (file.blockStyles.length > 0) {
    for (const body of bodyTree(file).keys()) {
      if (body.styles.length > 0) {
        bodies.push(body);
      }
    }
    bodies.sort((a, b) => a.start - b.start);
  }
  const blocks: BlockStyle[] = [];
  for (const body of bodies) {
    const number = blocks.length + 1;
    const block: BlockStyle = {
      body,
      attribute: `${attribute}-${number}`,
      variables: [],
      targets: [],
    };
    const blockState: StyleState = {
      ...state,
      variables: block.variables,
      targets: block.targets,
    };
    for (const style of body.styles) {
      const css = compileStyle(
        file,
        style,
        block.attribute,
        (index) => `--s-${scope}-${number}-${index}`,
        blockState,
        true,
      );
      if (css !== undefined) {
        parts.push(css);
      }
    }
    blocks.push(block);
  }
  return {
    css: parts.join('\n'),
    hasComponentCss,
    attribute,
    variables: state.variables,
    diagnostics: state.diagnostics,
    dependencies: state.dependencies,
    targets: state.targets,
    blocks,
    bodies: bodyStyles(file, blocks),
  };
}
