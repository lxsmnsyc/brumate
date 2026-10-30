// Warnings for common accessibility mistakes in markup. The compiler sees
// every element and attribute, so it can find them before the page runs.

import type { Attribute, ElementNode, Markup, SFCFile } from './ast.ts';
import type { Diagnostic } from './model.ts';
import { getChildren } from './project.ts';

/** Elements that a keyboard can reach and use without help. */
const INTERACTIVE = new Set([
  'a',
  'button',
  'details',
  'input',
  'label',
  'option',
  'select',
  'summary',
  'textarea',
]);

/** Fields whose type has no label of its own to give. */
const UNLABELLED_TYPES = new Set(['hidden', 'submit', 'reset', 'button', 'image']);

/** An attribute of an element: its static value, `true` for a dynamic one, or undefined. */
function attribute(element: ElementNode, name: string): string | true | undefined {
  for (const item of element.attributes) {
    if (item.kind === 'static' && item.name === name) {
      return item.value;
    }
    if (item.kind === 'value' && item.name === name) {
      return true;
    }
  }
  return undefined;
}

/** True when the element spreads or computes attributes, so any attribute can be there. */
function hasUnknownAttributes(attributes: Attribute[]): boolean {
  for (const item of attributes) {
    if (item.kind === 'spread' || item.kind === 'computed') {
      return true;
    }
  }
  return false;
}

function hasEvent(element: ElementNode, events: string[]): boolean {
  for (const item of element.attributes) {
    if (item.kind === 'event' && events.includes(item.event)) {
      return true;
    }
  }
  return false;
}

/** True when an element names itself with ARIA or a title. */
function hasAccessibleName(element: ElementNode): boolean {
  for (const name of ['aria-label', 'aria-labelledby', 'title']) {
    const value = attribute(element, name);
    if (value === true || (typeof value === 'string' && value.trim() !== '')) {
      return true;
    }
  }
  return false;
}

/**
 * True when markup has text for a screen reader to read. An inserted value,
 * a component or a block may render text, so they count.
 */
function hasText(nodes: Markup[]): boolean {
  for (const node of nodes) {
    if (hasNodeText(node)) {
      return true;
    }
  }
  return false;
}

function hasNodeText(node: Markup): boolean {
  switch (node.kind) {
    case 'text':
      return node.value.trim() !== '';
    case 'element': {
      if (hasUnknownAttributes(node.attributes) || hasAccessibleName(node)) {
        return true;
      }
      if (node.tag === 'img') {
        const alt = attribute(node, 'alt');
        return alt === true || (typeof alt === 'string' && alt.trim() !== '');
      }
      return attribute(node, 'aria-hidden') !== 'true' && hasText(node.children);
    }
    case 'fragment':
      return hasText(node.children);
    case 'listener':
      return false;
    default:
      return true;
  }
}

/** The range of the start of an opening tag, such as `<img`. */
function tagRange(element: ElementNode): { start: number; end: number } {
  return { start: element.start, end: element.start + 1 + element.tag.length };
}

/** Finds common accessibility mistakes in the markup of a file. */
export function checkAccessibility(file: SFCFile): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  function warn(element: ElementNode, message: string): void {
    diagnostics.push({ severity: 'warning', message, range: tagRange(element) });
  }

  // The IDs that a `<label for>` names, so the field with that ID has a label.
  const labelled = new Set<string>();
  let dynamicLabel = false;
  const roots: Markup[][] = [file.children];
  for (const template of file.templates) {
    roots.push(template.body.children);
  }
  function collect(nodes: Markup[]): void {
    for (const node of nodes) {
      if (node.kind === 'element' && node.tag === 'label') {
        const target = attribute(node, 'for');
        if (typeof target === 'string') {
          labelled.add(target);
        } else if (target === true) {
          dynamicLabel = true;
        }
      }
      collect(getChildren(node));
    }
  }
  for (const nodes of roots) {
    collect(nodes);
  }

  function visit(nodes: Markup[], inLabel: boolean): void {
    for (const node of nodes) {
      if (node.kind !== 'element') {
        visit(getChildren(node), inLabel);
        continue;
      }
      if (!hasUnknownAttributes(node.attributes)) {
        check(node, inLabel);
      }
      visit(node.children, inLabel || node.tag === 'label');
    }
  }

  function check(element: ElementNode, inLabel: boolean): void {
    const { tag } = element;
    if (tag === 'img' && attribute(element, 'alt') === undefined) {
      warn(element, 'An <img> needs alt text. Use alt="" for an image that only decorates.');
    }
    if (
      hasEvent(element, ['click']) &&
      !INTERACTIVE.has(tag) &&
      (attribute(element, 'role') === undefined ||
        !hasEvent(element, ['keydown', 'keyup', 'keypress']))
    ) {
      warn(
        element,
        `A click handler on <${tag}> works only with a pointer. Use a <button>, or add a role, a tabindex and a key handler.`,
      );
    }
    const type = attribute(element, 'type');
    const isField =
      tag === 'select' ||
      tag === 'textarea' ||
      (tag === 'input' && !(typeof type === 'string' && UNLABELLED_TYPES.has(type)));
    if (isField && !inLabel && !hasAccessibleName(element)) {
      const id = attribute(element, 'id');
      const named = id === true || dynamicLabel || (typeof id === 'string' && labelled.has(id));
      if (!named) {
        warn(
          element,
          `A <${tag}> needs a label. Put it in a <label>, point a <label for> at its id, or add aria-label. A placeholder is not a label.`,
        );
      }
    }
    if (
      (tag === 'a' || tag === 'button') &&
      !hasAccessibleName(element) &&
      !hasText(element.children)
    ) {
      warn(
        element,
        tag === 'a'
          ? 'A link needs text that says where it goes, or aria-label.'
          : 'A button needs text that says what it does, or aria-label.',
      );
    }
  }
  for (const nodes of roots) {
    visit(nodes, false);
  }
  return diagnostics;
}
