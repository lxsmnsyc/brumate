// The steps of Transition, after the transition state of Terracotta 2.x: the classes of each
// step go on the element directly, and each step waits for the animations of the element.

import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

/** The flags of a transition on its element, for CSS without classes. */
export type Flag = 'closed' | 'enter' | 'leave' | 'transition';

/** What a Transition gives the TransitionChild elements inside it. */
export interface TransitionParent {
  /** The parent wants to be shown. */
  show: boolean;
  /** The parent has finished its enter, so a child without `appear` may enter. */
  entered: boolean;
}

export const TransitionContext: Context<TransitionParent | null> =
  createContext<TransitionParent | null>('brumate-ui:transition', null);

/** The classes of a class prop: a space-separated list, without the empty ones. */
export function classesOf(value: string | undefined): string[] {
  return (value ?? '').split(/\s+/).filter(Boolean);
}

export function addClasses(element: Element, classes: string[]): void {
  if (classes.length > 0) {
    element.classList.add(...classes);
  }
}

export function removeClasses(element: Element, classes: string[]): void {
  if (classes.length > 0) {
    element.classList.remove(...classes);
  }
}

export function setFlags(element: Element, flags: Partial<Record<Flag, boolean>>): void {
  for (const [flag, on] of Object.entries(flags)) {
    element.toggleAttribute(`data-${flag}`, on);
  }
}

/**
 * Makes the browser compute the style of the element as it is. A transition runs only between
 * two computed styles, so the starting state must be computed on its own, before the class with
 * the `transition` goes on.
 */
export function commitStyle(element: Element): void {
  void getComputedStyle(element).transitionProperty;
}

/**
 * Resolves once the element has no animation left running: a CSS transition, a CSS animation
 * or a Web Animation. With `subtree`, the animations of the elements inside it count too, such
 * as the leave of a TransitionChild. An element with nothing to animate resolves at once.
 */
export async function waitForAnimations(element: Element, subtree = false): Promise<void> {
  // Reading the animations computes the style, so the classes of every element of a group go
  // on before any of them is read.
  await Promise.resolve();
  try {
    const animations = element.getAnimations({ subtree });
    // An animation that is cancelled, such as by the opposite transition, ends the wait too.
    await Promise.all(animations.map(async (animation) => animation.finished.catch(() => {})));
  } catch {
    // A browser without getAnimations goes on at once.
  }
}

/** Resolves on the next frame, once the browser has drawn the changes before it. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** The classes of each step of a transition, each a list. Every list can be empty. */
export interface StepClasses {
  enter: string[];
  enterFrom: string[];
  enterTo: string[];
  entered: string[];
  leave: string[];
  leaveFrom: string[];
  leaveTo: string[];
}

/** The classes of the class props of a transition. A part with `transition` has none. */
export function stepClasses(props: Partial<Record<keyof StepClasses, string>> = {}): StepClasses {
  return {
    enter: classesOf(props.enter),
    enterFrom: classesOf(props.enterFrom),
    enterTo: classesOf(props.enterTo),
    entered: classesOf(props.entered),
    leave: classesOf(props.leave),
    leaveFrom: classesOf(props.leaveFrom),
    leaveTo: classesOf(props.leaveTo),
  };
}

/** The options of a run of steps. */
export interface StepOptions {
  /** False once a later run has started, so this one stops at its next step. */
  current: () => boolean;
  /**
   * A CSS variable that holds the height of the content while it moves, such as
   * `--disclosure-panel-height`, so CSS can animate the height from and to nothing.
   */
  height?: string;
  /**
   * Waits for the animations of the elements inside too, such as the box of a modal that moves
   * while its overlay fades.
   */
  subtree?: boolean;
}

/** The height of the content of the element, as a CSS length. */
function contentHeight(element: HTMLElement): string {
  return `${element.scrollHeight}px`;
}

/**
 * Enters the element: closed with the from classes, then the to classes, then at rest. Resolves
 * true when it has finished, or false when a later run stopped it.
 */
export async function enterSteps(
  element: HTMLElement,
  classes: StepClasses,
  options: StepOptions,
): Promise<boolean> {
  const { current, height, subtree = false } = options;
  removeClasses(element, [...classes.leave, ...classes.leaveFrom, ...classes.leaveTo]);
  setFlags(element, { leave: false, closed: true, enter: true, transition: true });
  if (height) {
    element.style.setProperty(height, '0px');
  }
  // The start goes on and is computed on its own, before the class with the transition.
  addClasses(element, classes.enterFrom);
  commitStyle(element);
  addClasses(element, classes.enter);
  await waitForAnimations(element, subtree);
  if (!current()) {
    return false;
  }
  removeClasses(element, classes.enterFrom);
  setFlags(element, { closed: false });
  addClasses(element, classes.enterTo);
  if (height) {
    element.style.setProperty(height, contentHeight(element));
  }
  await waitForAnimations(element, subtree);
  if (!current()) {
    return false;
  }
  removeClasses(element, [...classes.enter, ...classes.enterTo]);
  setFlags(element, { enter: false, transition: false });
  addClasses(element, classes.entered);
  // At rest, the content takes its own height again, which can change.
  if (height) {
    element.style.removeProperty(height);
  }
  return true;
}

/**
 * Leaves the element, once the transitions inside it have left: the from classes, then the to
 * classes and closed. Resolves true when it has finished, or false when a later run stopped it.
 */
export async function leaveSteps(
  element: HTMLElement,
  classes: StepClasses,
  options: StepOptions,
  start?: () => void,
): Promise<boolean> {
  const { current, height, subtree = false } = options;
  // The children leave first, once their code has seen the change.
  await nextFrame();
  await waitForAnimations(element, true);
  if (!current()) {
    return false;
  }
  start?.();
  removeClasses(element, [
    ...classes.entered,
    ...classes.enter,
    ...classes.enterFrom,
    ...classes.enterTo,
  ]);
  setFlags(element, { enter: false, leave: true, transition: true });
  if (height) {
    element.style.setProperty(height, contentHeight(element));
  }
  addClasses(element, classes.leaveFrom);
  commitStyle(element);
  addClasses(element, classes.leave);
  await waitForAnimations(element, subtree);
  if (!current()) {
    return false;
  }
  removeClasses(element, classes.leaveFrom);
  setFlags(element, { closed: true });
  addClasses(element, classes.leaveTo);
  if (height) {
    element.style.setProperty(height, '0px');
  }
  await waitForAnimations(element, subtree);
  if (!current()) {
    return false;
  }
  removeClasses(element, [...classes.leave, ...classes.leaveTo]);
  setFlags(element, { leave: false, transition: false });
  if (height) {
    element.style.removeProperty(height);
  }
  return true;
}
