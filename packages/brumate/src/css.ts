import { builtin } from './node.ts';
import { parse } from 'postcss';
import type { AtRule, Root } from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { bodyTree, fileBody } from './ast.ts';
import type { Body, BodyInfo, Expression, SFCFile, Style } from './ast.ts';
import type { Diagnostic } from './model.ts';

export interface StyleOutput {
  /**
   * The CSS of every `<style>`, the file's and then those of the blocks, scoped except
   * `<style global>`, or an empty string.
   */
  css: string;
  diagnostics: Diagnostic[];
  /** Absolute paths of the files that SCSS or Less imported. */
  dependencies: string[];
  /**
   * The style of every body that has CSS, in source order: the file's first, and then the blocks'. Their
   * rules follow in `css` in this order, so a rule of an inner block comes after an outer one.
   */
  blocks: BlockStyle[];
  /**
   * What each body of the file takes from `blocks`, the file's body included. Bodies that take
   * nothing are not in it, and it is empty when no style has CSS.
   */
  bodies: Map<Body, BodyStyles>;
}

export interface StyleVariable {
  name: string;
  expression: Expression;
  prefix: string;
  suffix: string;
}

/**
 * The `<style>` of one body: a block's, or the file's own (`fileBody`). The file's attribute is
 * `b-c-<hash>` and its variables `--s-<hash>-<index>`.
 */
export interface BlockStyle {
  body: Body;
  /** The attribute that marks the elements its rules reach, such as `b-c-1abc-1`. */
  attribute: string;
  /** Its `${…}` interpolations, named `--s-<hash>-<n>-<index>` in a block. */
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
 * What each body takes from the styles around it. See `BodyStyles`. A body that no style reaches
 * is left out. The file's own style reaches every body and the file's body. Its variables go on
 * the top-level elements of the bodies that sit at the top level of the file, and of a template,
 * which renders anywhere.
 */
function bodyStyles(file: SFCFile, blocks: BlockStyle[]): Map<Body, BodyStyles> {
  const result = new Map<Body, BodyStyles>();
  if (blocks.length === 0) {
    return result;
  }
  const root = fileBody(file);
  const byBody = new Map<Body, BlockStyle>();
  for (const block of blocks) {
    byBody.set(block.body, block);
  }
  const tree = bodyTree(file);
  const outermost = byBody.get(root);
  if (outermost) {
    result.set(root, {
      attributes: [outermost],
      variables: outermost.variables.length > 0 ? [outermost] : [],
    });
  }
  for (const body of tree.keys()) {
    const attributes: BlockStyle[] = [];
    const variables: BlockStyle[] = [];
    let atTop = true;
    let atRoot = true;
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
      atRoot = atRoot && (info.top || info.template);
      current = info.parent;
    }
    if (outermost) {
      attributes.unshift(outermost);
      if (atRoot && outermost.variables.length > 0) {
        variables.unshift(outermost);
      }
    }
    if (attributes.length > 0) {
      result.set(body, { attributes, variables });
    }
  }
  return result;
}

/**
 * Compiles the `<style>` elements of a file into scoped CSS, one style for each body that has
 * any, each with its own attribute. The file's body comes first.
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
  // A body comes after the body around it, so its rules win at the same specificity.
  const root = fileBody(file);
  const bodies: Body[] = [root];
  if (file.blockStyles.length > 0) {
    const inner: Body[] = [];
    for (const body of bodyTree(file).keys()) {
      if (body.styles.length > 0) {
        inner.push(body);
      }
    }
    inner.sort((a, b) => a.start - b.start);
    bodies.push(...inner);
  }
  const blocks: BlockStyle[] = [];
  const parts: string[] = [];
  let rootStyle: BlockStyle | undefined;
  for (const body of bodies) {
    if (body.styles.length === 0) {
      continue;
    }
    // The file's names are the component's, and a block's carry its number.
    const number = body === root ? undefined : blocks.length - (rootStyle ? 1 : 0) + 1;
    const block: BlockStyle =
      body === root
        ? { body, attribute, variables: state.variables, targets: state.targets }
        : { body, attribute: `${attribute}-${number}`, variables: [], targets: [] };
    const blockState: StyleState = {
      ...state,
      variables: block.variables,
      targets: block.targets,
    };
    const own: string[] = [];
    for (const style of body.styles) {
      const css = compileStyle(
        file,
        style,
        block.attribute,
        (index) =>
          number === undefined ? `--s-${scope}-${index}` : `--s-${scope}-${number}-${index}`,
        blockState,
      );
      if (css !== undefined) {
        own.push(css);
      }
    }
    parts.push(...own);
    if (body === root) {
      // A file whose style has no CSS has no style, so its elements do not get the attribute.
      if (own.join('\n') !== '') {
        rootStyle = block;
        blocks.push(block);
      }
    } else {
      blocks.push(block);
    }
  }
  return {
    css: parts.join('\n'),
    diagnostics: state.diagnostics,
    dependencies: state.dependencies,
    blocks,
    bodies: bodyStyles(file, blocks),
  };
}
