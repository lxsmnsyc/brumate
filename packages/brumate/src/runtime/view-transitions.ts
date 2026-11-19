// Starts the view transitions of `transition()` and of client navigation. The elements that a page
// marks with `viewTransition` and `viewTransitionName` (written `b-vt` and `b-vtn`) get a
// `view-transition-name` only while a transition runs, so nothing takes part in a transition that
// did not ask for it.
import { HAS_VIEW_TRANSITIONS } from './features.ts';

const DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV;

const MARKED = '[b-vt],[b-vtn]';

/** The number that names an element, kept for the element so it keeps its name when a list moves it. */
const numbers = new WeakMap<Element, number>();
let counter = 0;

/** True when an element is at least partly inside the viewport. */
function isVisible(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return (
    box.width + box.height > 0 &&
    box.bottom > 0 &&
    box.right > 0 &&
    box.top < innerHeight &&
    box.left < innerWidth
  );
}

/** Names that CSS keeps for itself: `none` and `auto` are values, the others are keywords of every property. */
const RESERVED = new Set([
  'none',
  'auto',
  'initial',
  'inherit',
  'unset',
  'revert',
  'revert-layer',
  'default',
]);

/** The transitions that hold a name on an element, so a transition that ends leaves the names of a newer one. */
const owners = new Map<HTMLElement, number>();

/** Says which element a warning is about, such as `<li class="card">`. */
function describe(element: Element): string {
  const tag = element.localName;
  const id = element.id ? `#${element.id}` : '';
  const classes = element.classList.length > 0 ? `.${[...element.classList].join('.')}` : '';
  return `<${tag}${id}${classes}>`;
}

/** Escapes text so it is one CSS identifier: `5` is `\35 `, and a space stays in the name. */
function escapeIdent(text: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(text) : text;
}

/**
 * The name of a marked element: its own `viewTransitionName`, or the class and a number. The name
 * is escaped to a CSS identifier, so an ID such as `5` or a name with a space pairs on two pages.
 * Returns undefined for a name that CSS keeps, with a warning in development.
 */
function nameOf(element: HTMLElement): string | undefined {
  const own = element.getAttribute('b-vtn');
  if (own) {
    if (RESERVED.has(own.toLowerCase())) {
      if (DEV) {
        console.warn(
          `${describe(element)} has the view transition name "${own}", which CSS keeps. Give it another name.`,
        );
      }
      return undefined;
    }
    return escapeIdent(own);
  }
  let number = numbers.get(element);
  if (number === undefined) {
    number = ++counter;
    numbers.set(element, number);
  }
  const first = (element.getAttribute('b-vt') ?? '').trim().split(/\s+/)[0];
  return escapeIdent(`${first || 'vt'}-${number}`);
}

/**
 * Names the marked elements that are in view and have no name yet, and adds them to `named`. An
 * element that a transition still running has named is shared, and keeps its name. An element
 * whose name is taken by another one of the page is left without one, since two elements with a
 * name make the browser skip the transition.
 */
function nameElements(named: Set<HTMLElement>): void {
  const taken = new Set<string>();
  for (const element of owners.keys()) {
    if (element.isConnected) {
      taken.add(element.style.viewTransitionName);
    }
  }
  for (const element of document.querySelectorAll<HTMLElement>(MARKED)) {
    if (named.has(element) || !isVisible(element)) {
      continue;
    }
    if (owners.has(element)) {
      named.add(element);
      owners.set(element, owners.get(element)! + 1);
      continue;
    }
    const name = nameOf(element)?.trimEnd();
    if (name === undefined) {
      continue;
    }
    if (taken.has(name)) {
      if (DEV) {
        console.warn(
          `${describe(element)} has the view transition name "${name}", which another element has. It gets none.`,
        );
      }
      continue;
    }
    element.style.viewTransitionName = name;
    if (element.style.viewTransitionName === '') {
      if (DEV) {
        console.warn(
          `${describe(element)} has the view transition name "${name}", which is not a CSS identifier. It gets none.`,
        );
      }
      continue;
    }
    taken.add(name);
    const own = element.getAttribute('b-vt');
    if (own) {
      element.style.setProperty('view-transition-class', own);
    }
    named.add(element);
    owners.set(element, 1);
  }
}

/** Removes the names that a transition set, except those that a newer transition still holds. */
function clearNames(named: Set<HTMLElement>): void {
  for (const element of named) {
    const count = (owners.get(element) ?? 1) - 1;
    if (count > 0) {
      owners.set(element, count);
      continue;
    }
    owners.delete(element);
    element.style.removeProperty('view-transition-name');
    element.style.removeProperty('view-transition-class');
    if (element.getAttribute('style') === '') {
      element.removeAttribute('style');
    }
  }
  named.clear();
}

/** Starts the transition, with `types` when the browser knows them. */
function begin(update: () => unknown, types: string[]): ViewTransition {
  // Browsers that have transitions without types take only a callback.
  return types.length > 0 &&
    typeof ViewTransition !== 'undefined' &&
    'types' in ViewTransition.prototype
    ? document.startViewTransition({ update, types })
    : document.startViewTransition(update);
}

/**
 * Starts a view transition around `update`, with `types` when the browser knows them. A page that
 * marks elements gets them named for the transition, and unnamed when it ends.
 */
export function startTransition(update: () => unknown, types: string[]): ViewTransition {
  if (!HAS_VIEW_TRANSITIONS) {
    return begin(update, types);
  }
  const named = new Set<HTMLElement>();
  // The old state has the elements that are in view; the new state, those that the update added.
  nameElements(named);
  async function run(): Promise<unknown> {
    try {
      return await update();
    } finally {
      nameElements(named);
    }
  }
  let started: ViewTransition;
  try {
    started = begin(run, types);
  } catch (error) {
    clearNames(named);
    throw error;
  }
  const clear = (): void => clearNames(named);
  started.finished.then(clear, clear);
  return started;
}
