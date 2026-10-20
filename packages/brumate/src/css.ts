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

/** Compiles the `<style>` blocks of a file into scoped CSS. */
export function compileStyles(file: SFCFile, scope: string): StyleOutput {
  const attribute = `s-${scope}`;
  const diagnostics: Diagnostic[] = [];
  const variables: StyleOutput['variables'] = [];
  const parts: string[] = [];
  for (const style of file.styles) {
    if (style.lang !== 'css') {
      diagnostics.push({
        severity: 'error',
        message: `<style lang="${style.lang}"> is not supported yet. Use CSS`,
        range: { start: style.start, end: style.end },
      });
      continue;
    }
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
      const root = parse(content);
      scopeRules(root, attribute);
      parts.push(root.toString().trim());
    } catch (error) {
      diagnostics.push({
        severity: 'error',
        message: `Invalid CSS: ${(error as Error).message}`,
        range: { start: style.start, end: style.end },
      });
    }
  }
  return { css: parts.join('\n'), attribute, variables, diagnostics };
}
