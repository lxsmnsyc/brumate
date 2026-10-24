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
