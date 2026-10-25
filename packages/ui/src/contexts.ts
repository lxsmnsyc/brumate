// The contexts of the part types. A part that holds other parts provides their props here, and
// each part reads its own with `slotProps`.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { HoverEvent, PressEvent } from './events.ts';
import type { ContextValue } from './slots.ts';

/** The props of a Button that a context can give. */
export interface ButtonContextProps {
  isDisabled?: boolean;
  isPending?: boolean;
  onPress?: (event: PressEvent) => void;
  onPressStart?: (event: PressEvent) => void;
  onPressEnd?: (event: PressEvent) => void;
  onPressUp?: (event: PressEvent) => void;
  onPressChange?: (pressed: boolean) => void;
  onHoverStart?: (event: HoverEvent) => void;
  onHoverEnd?: (event: HoverEvent) => void;
  onHoverChange?: (hovered: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
  [attribute: string]: unknown;
}

export const ButtonContext: Context<ContextValue<ButtonContextProps> | null> =
  createContext<ContextValue<ButtonContextProps> | null>('brumate-ui:button', null);
