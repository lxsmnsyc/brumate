// The events that the handlers of the parts get, after the events of React Aria.

/** What started a press. `virtual` is a click with no pointer, such as from a screen reader. */
export type PointerKind = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual';

export interface PressEvent {
  type: 'pressstart' | 'pressend' | 'pressup' | 'press';
  pointerType: PointerKind;
  target: Element;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** The point of the pointer in the viewport, or 0 for a key. */
  x: number;
  y: number;
  /** The pointer of a press by a pointer, which a long press cancels. */
  pointerId?: number;
}

export interface HoverEvent {
  type: 'hoverstart' | 'hoverend';
  pointerType: 'mouse' | 'pen';
  target: Element;
}
