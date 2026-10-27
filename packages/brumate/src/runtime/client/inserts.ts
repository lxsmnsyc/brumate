// Writes of the values that markup inserts: text, content, attributes and spreads of elements, and
// `#portal` bodies.

import { HAS_BINDINGS, HAS_CHILDREN, HAS_TEMPLATES } from '../features.ts';
import { attributeText, insertValue, onValue, textValue } from '../html.ts';
import { isBinding, isSlotReference } from '../shared.ts';
import type { ScopeId } from '../shared.ts';
import { findComment, findElement, rangeEnd } from './blocks.ts';
import type { Render } from './branches.ts';
import { Children, RenderedChildren, TemplateCall } from './children.ts';
import { loadedFunction } from './code.ts';
import { spreadEntries } from './handlers.ts';
import { insertHTML, refreshing } from './insert.ts';
import { prop, spreadProps } from './props.ts';
import { afterInsert, disposeKinds, inPlace, nextId } from './scopes.ts';
import { hiding, options, scopes } from './state.ts';
import type { Scope } from './state.ts';
import { set } from './updates.ts';

/**
 * Renders a `#portal` body into its target, between markers with its scope
 * ID. `kinds` names the body, so a new target first removes it from the old one.
 */
export function portalTo(
  scope: Scope,
  target: unknown,
  render: Render,
  kinds: number[] = [],
  holderKind?: number,
  holderAnchor?: number,
): void {
  disposeKinds(scope, kinds);
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(element instanceof Element)) {
    return;
  }
  // The body's scope is the first scope that the render creates.
  const id = nextId;
  const body = inPlace(scope, render, holderKind, holderAnchor)!;
  insertHTML({ parent: element }, `<!--P${id}-->${body(scope)}<!--/P-->`);
}

/** Writes an inserted value between `<!--t…-->` and `<!--/t-->`. */
export function text(scope: Scope, anchor: number, value: unknown): void {
  // A clone keeps the text node of the insert, or the start comment of its markers.
  let kept = scope.n?.[anchor];
  if (kept?.nodeType === 3 && kept.isConnected) {
    if (typeof value === 'string' || typeof value === 'number') {
      const data = String(value);
      if ((kept as Text).data !== data) {
        (kept as Text).data = data;
      }
      return;
    }
    // Another value needs the markers of an insert around it, which the text node gets now.
    const start = document.createComment(`t${scope.id}:${anchor}`);
    (kept as Text).before(start);
    (kept as Text).after(document.createComment('/t'));
    scope.n![anchor] = kept = start;
  }
  const start = kept?.isConnected ? (kept as Comment) : findComment(`t${scope.id}:${anchor}`);
  if (start) {
    write(start.parentNode!, start.nextSibling, rangeEnd(start), value, scope, start, anchor);
  }
}

/** Writes an inserted value that is the whole content of the element with the anchor. */
export function content(scope: Scope, anchor: number, value: unknown): void {
  const element = findElement(scope.id, anchor);
  if (element) {
    write(element, element.firstChild, null, value, scope, element, anchor);
  }
}

/**
 * Writes the text of an element whose content is text, such as a `<textarea>`
 * or a `<title>`. A `<textarea>` gets the value too, as `value` does on an
 * `<input>`, so a change replaces what the user typed.
 */
export function writeText(scope: Scope, anchor: number, value: unknown): void {
  const element = findElement(scope.id, anchor);
  if (element) {
    const written = textValue(value);
    // Each is written only when it differs, as a write of the same text still notifies observers.
    if (element.textContent !== written) {
      element.textContent = written;
    }
    if (element instanceof HTMLTextAreaElement && element.value !== written) {
      element.value = written;
    }
  }
}

/**
 * Replaces the nodes of `parent` from `first` up to `end`, or to its last
 * child, with a value. A text node that stays a text node keeps its node.
 */
function write(
  parent: Node & ParentNode,
  first: ChildNode | null,
  end: Node | null,
  value: unknown,
  at?: Scope,
  key?: Node,
  anchor?: number,
): void {
  // The same template again at an insert updates in place, with its new arguments, as a snippet
  // of Svelte does. Its elements and their focus stay.
  // The server rendered what an insert shows until its first write in the browser.
  const firstWrite = key !== undefined && !writtenInserts.has(key);
  // A refresh of markup from the server keeps the children that the server rendered at this
  // insert, so their nodes and focus stay. Their scopes refresh on their own.
  if (
    HAS_CHILDREN &&
    refreshing &&
    firstWrite &&
    value instanceof RenderedChildren &&
    value.at !== undefined &&
    value.at === at?.id &&
    value.anchor === anchor
  ) {
    return;
  }
  if (key) {
    writtenInserts.add(key);
  }
  if (HAS_TEMPLATES && key && value instanceof TemplateCall) {
    const known =
      templateInserts.get(key) ??
      (firstWrite
        ? renderedTemplate(value, at, loadedFunction(`${value.ref}k`) as unknown as number)
        : undefined);
    // The template's `a` export gives the slots of its arguments, also of destructured ones.
    const slotsOf = loadedFunction(`${value.ref}a`) as
      | ((...args: unknown[]) => [number, unknown][])
      | undefined;
    if (known && slotsOf && known.ref === value.ref && scopes.has(known.scope.id)) {
      templateInserts.set(key, known);
      for (const [slot, next] of slotsOf(...value.args)) {
        set(known.scope, slot, next);
      }
      return;
    }
  }
  if (
    (typeof value === 'string' || typeof value === 'number') &&
    first?.nodeType === 3 &&
    first.nextSibling === end
  ) {
    // Hidden text keeps its new value for when it shows.
    const saved = hiding?.nodes.get(first);
    const data = String(value);
    if (saved) {
      saved.v = data;
    } else if ((first as Text).data !== data) {
      // The same text again changes nothing, and a write would still notify observers.
      (first as Text).data = data;
    }
    return;
  }
  while (first && first !== end) {
    const next = first.nextSibling;
    first.remove();
    first = next;
  }
  // Children and templates render here, at the scope of the insert, for its contexts. The first
  // scope that a template makes is its own, which holds its arguments.
  const made = nextId;
  insertHTML(
    end ?? { parent },
    (HAS_CHILDREN || HAS_TEMPLATES) && value instanceof Children
      ? value.render(at)
      : insertValue(value),
  );
  if (HAS_TEMPLATES && key) {
    const scope = value instanceof TemplateCall ? scopes.get(made) : undefined;
    if (scope) {
      templateInserts.set(key, { ref: (value as TemplateCall).ref, scope });
    } else {
      templateInserts.delete(key);
    }
  }
}

/** The scope of the template that each insert shows, by the node that marks the insert. */
const templateInserts = new WeakMap<Node, { ref: string; scope: Scope }>();

/** The inserts that the browser wrote, which no longer show what the server rendered. */
const writtenInserts = new WeakSet<Node>();

/**
 * The scope of a template that the server rendered at an insert: the scope that the template's
 * component made, and that finds its contexts from the insert.
 */
function renderedTemplate(
  call: TemplateCall,
  at: Scope | undefined,
  k: number | undefined,
): { ref: string; scope: Scope } | undefined {
  if (k === undefined) {
    return undefined;
  }
  let found: Scope | undefined;
  for (const scope of scopes.values()) {
    // The scope is of this template, not of another template of the same component.
    if (call.owner && scope.p === call.owner && scope.t === at && scope.k === k) {
      // Two templates of the same component at one insert cannot be told apart.
      if (found) {
        return undefined;
      }
      found = scope;
    }
  }
  return found && { ref: call.ref, scope: found };
}

/** The `value` and `checked` that updates last wrote to each field. */
const fieldValues = new WeakMap<Element, Map<string, unknown>>();

function setAttribute(element: Element, name: string, value: unknown, spread = false): void {
  if (HAS_BINDINGS && isBinding(value)) {
    value = value.value;
  }
  // A write of the same value changes nothing on screen, yet it still costs a style check and
  // notifies observers, so each write is skipped when the element already has the value.
  if (name === 'value' || name === 'checked') {
    const field = element as unknown as Record<string, unknown>;
    const next = name === 'checked' ? Boolean(value) : String(value ?? '');
    // The field takes the value when it differs from the value that updates wrote last, not each
    // time an update runs, so what the user typed or checked stays while the value stays, such
    // as the posted values of a form that validation reads again. Before the first write, the
    // field is compared as it is now. Two first writes compare it with what the server rendered,
    // so what the user typed or checked before the code loaded stays: an update of a scope that
    // resumed late, and an update of a spread, which another of its attributes can start.
    const written = fieldValues.get(element) ?? new Map<string, unknown>();
    fieldValues.set(element, written);
    let rendered: unknown;
    if (refreshing || spread) {
      rendered = name === 'checked' ? field.defaultChecked : field.defaultValue;
    }
    const before = written.has(name) ? written.get(name) : (rendered ?? field[name]);
    written.set(name, next);
    if (!Object.is(before, next) && field[name] !== next) {
      field[name] = next;
    }
  }
  let written = attributeText(name, value);
  if (name === 'style' && element.hasAttribute('b-v')) {
    written = withVariables(element as HTMLElement, written);
  }
  if (element.getAttribute(name) === (written ?? null)) {
    return;
  }
  if (written === undefined) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, written);
  }
  if (name === 'style') {
    hiding?.styled(element);
  }
}

/**
 * A new style for a top-level element of a component, with the style variables of the component
 * that the element has now, so a style that a spread passes on does not remove them.
 */
function withVariables(element: HTMLElement, style: string | undefined): string | undefined {
  const variables: string[] = [];
  for (const property of Array.from(element.style)) {
    if (/^--s-[\w-]+-\d+$/.test(property)) {
      variables.push(`${property}:${element.style.getPropertyValue(property)}`);
    }
  }
  if (variables.length === 0) {
    return style;
  }
  // After the style: the variable has the live value, and a style that holds an older one loses.
  return style ? `${style};${variables.join(';')}` : variables.join(';');
}

export function attr(scope: Scope, anchor: number, name: string, value: unknown): void {
  // A dynamic tag that names a component passes the value on as a prop.
  if (scope.c?.[anchor] !== undefined) {
    prop(scope, anchor, name, value);
    return;
  }
  const element = findElement(scope.id, anchor);
  if (element) {
    setAttribute(element, name, value);
  }
}

/** The attributes that the last update of a spread wrote, so the next one removes those it drops. */
const spreadNames = new WeakMap<Element, Set<string>>();

/** Gives the element of a spread to the signal that a `ref` in its attributes is bound to. */
function forwardRef(element: Element | null, values: Record<string, unknown>): void {
  const bound = values.ref;
  const target = HAS_BINDINGS && isBinding(bound) && isSlotReference(bound.target) && bound.target;
  const owner = target && scopes.get(target.scope);
  if (owner && element) {
    set(owner, target.slot, element);
  }
}

/** The element of a spread in markup that the browser renders goes to the `ref` of its attributes. */
export function restRef<T extends Record<string, unknown>>(
  values: T,
  scope: ScopeId,
  anchor: number,
): T {
  afterInsert.push(() => forwardRef(findElement(scope, anchor), values));
  return values;
}

export function attrs(
  scope: Scope,
  anchor: number,
  values: Record<string, unknown>,
  own: string[] = [],
): void {
  // A dynamic tag that names a component passes the attributes on as props.
  if (scope.c?.[anchor] !== undefined) {
    spreadProps(scope, anchor, values, []);
    return;
  }
  const element = findElement(scope.id, anchor);
  if (element) {
    // The first update in the browser takes the attributes that `b-s` names as the ones that
    // the spread wrote, so it keeps the attributes that other code set, such as an
    // `aria-controls` that a `$client` callback added. Without `b-s`, it takes the attributes
    // that are not the element's own, nor those of brumate.
    if (!spreadNames.has(element)) {
      const written = element.getAttribute('b-s');
      spreadNames.set(
        element,
        new Set(
          (written === null ? element.getAttributeNames() : written.split(' ')).filter(
            (name) => name !== '' && !own.includes(name) && !name.startsWith('b-'),
          ),
        ),
      );
    }
    const names = new Set<string>();
    for (const [name, value] of Object.entries(values)) {
      // Brumate writes its own `b-` attributes apart, and data cannot write them.
      if (
        name !== 'children' &&
        !/^on[A-Z]/.test(name) &&
        !name.startsWith('b-') &&
        !(name === 'ref' && isBinding(value))
      ) {
        names.add(name);
        setAttribute(element, name, value, true);
      }
    }
    for (const name of spreadNames.get(element) ?? []) {
      if (!names.has(name)) {
        setAttribute(element, name, undefined);
      }
    }
    spreadNames.set(element, names);
    updateSpreadEntries(element, values);
    forwardRef(element, values);
  }
}

/**
 * Writes the handlers and bindings of a spread into `b-on` again, as they are now. The entries of
 * a spread name their scope after `@`, and the element's own entries do not, so those stay.
 */
function updateSpreadEntries(element: Element, values: Record<string, unknown>): void {
  const before = element.getAttribute('b-on') ?? '';
  const own = before
    .split(' ')
    .filter((entry) => entry && !entry.includes('@'))
    .join(' ');
  const after = onValue(spreadEntries(values), own);
  if (after === before) {
    return;
  }
  if (after) {
    element.setAttribute('b-on', after);
  } else {
    element.removeAttribute('b-on');
  }
  // The loader listens to the events of the new entries, and prevents what their wrappers name.
  options.listen(element);
}
