// The events of the DOM whose name has more than one word, in camel case. A handler is written
// in camel case only (`onKeyDown`), so the parser reports the lower-case form (`onKeydown`).
// ElementEventNames in elements.d.ts has the same names, and a test keeps them equal.
export const CAMEL_EVENTS: readonly string[] = [
  'AfterPrint',
  'AnimationCancel',
  'AnimationEnd',
  'AnimationIteration',
  'AnimationStart',
  'AuxClick',
  'BeforeInput',
  'BeforeMatch',
  'BeforePrint',
  'BeforeToggle',
  'BeforeUnload',
  'CanPlay',
  'CanPlayThrough',
  'CompositionEnd',
  'CompositionStart',
  'CompositionUpdate',
  'ContextLost',
  'ContextMenu',
  'ContextRestored',
  'CueChange',
  'DblClick',
  'DeviceMotion',
  'DeviceOrientation',
  'DeviceOrientationAbsolute',
  'DragEnd',
  'DragEnter',
  'DragLeave',
  'DragOver',
  'DragStart',
  'DurationChange',
  'FocusIn',
  'FocusOut',
  'FormData',
  'FullscreenChange',
  'FullscreenError',
  'GamepadConnected',
  'GamepadDisconnected',
  'GotPointerCapture',
  'HashChange',
  'KeyDown',
  'KeyPress',
  'KeyUp',
  'LanguageChange',
  'LoadStart',
  'LoadedData',
  'LoadedMetadata',
  'LostPointerCapture',
  'MessageError',
  'MouseDown',
  'MouseEnter',
  'MouseLeave',
  'MouseMove',
  'MouseOut',
  'MouseOver',
  'MouseUp',
  'OrientationChange',
  'PageHide',
  'PageReveal',
  'PageShow',
  'PageSwap',
  'PointerCancel',
  'PointerDown',
  'PointerEnter',
  'PointerLeave',
  'PointerLockChange',
  'PointerLockError',
  'PointerMove',
  'PointerOut',
  'PointerOver',
  'PointerRawUpdate',
  'PointerUp',
  'PopState',
  'RateChange',
  'ReadyStateChange',
  'RejectionHandled',
  'ScrollEnd',
  'SecurityPolicyViolation',
  'SelectStart',
  'SelectionChange',
  'SlotChange',
  'TimeUpdate',
  'TouchCancel',
  'TouchEnd',
  'TouchMove',
  'TouchStart',
  'TransitionCancel',
  'TransitionEnd',
  'TransitionRun',
  'TransitionStart',
  'UnhandledRejection',
  'VisibilityChange',
  'VolumeChange',
];

const BY_LOWER = new Map<string, string>();
for (const name of CAMEL_EVENTS) {
  BY_LOWER.set(`on${name.toLowerCase()}`, `on${name}`);
}

/** The camel-case name for a handler written in another case, such as `onKeyDown` for `onKeydown`. */
export function camelEventName(attribute: string): string | undefined {
  const camel = BY_LOWER.get(attribute.toLowerCase());
  return camel === attribute ? undefined : camel;
}

// Events of the DOM whose name has capitals, or whose lower-case form the browser never fires. A
// handler name is lower-cased to the event (`onDOMContentLoaded` listens to `domcontentloaded`),
// so none of these can be written as a handler. The value is what to write instead.
const NO_HANDLER = new Map<string, string>([
  [
    'domcontentloaded',
    "The page code loads after the HTML, mostly after this event, and a client navigation never fires it. Run code at load with $client(fn, 'load')",
  ],
  ['domactivate', 'The event is deprecated. Write onClick'],
  ['domfocusin', 'The event is deprecated. Write onFocusIn'],
  ['domfocusout', 'The event is deprecated. Write onFocusOut'],
  ['dommousescroll', 'The event is not standard. Write onWheel'],
  ['mozmousepixelscroll', 'The event is not standard. Write onWheel'],
  ['webkitanimationstart', 'The browser fires the prefixed name only. Write onAnimationStart'],
  [
    'webkitanimationiteration',
    'The browser fires the prefixed name only. Write onAnimationIteration',
  ],
  ['webkitanimationend', 'The browser fires the prefixed name only. Write onAnimationEnd'],
  ['webkittransitionend', 'The browser fires the prefixed name only. Write onTransitionEnd'],
]);
for (const mutation of [
  'DOMAttrModified',
  'DOMCharacterDataModified',
  'DOMNodeInserted',
  'DOMNodeInsertedIntoDocument',
  'DOMNodeRemoved',
  'DOMNodeRemovedFromDocument',
  'DOMSubtreeModified',
]) {
  NO_HANDLER.set(
    mutation.toLowerCase(),
    'The event is removed. Observe the DOM with a MutationObserver',
  );
}

/** What to write instead of a handler for an event that has none, such as `onDOMContentLoaded`. */
export function noHandlerFix(attribute: string): string | undefined {
  return NO_HANDLER.get(attribute.slice(2).toLowerCase());
}
