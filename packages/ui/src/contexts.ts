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

/** The attributes of a part that a context can give, such as `id` or `aria-label`. */
export interface AttributeProps {
  [attribute: string]: unknown;
}

/** The props of a Heading that a context can give, such as the level. */
export interface HeadingContextProps extends AttributeProps {
  level?: number;
}

export const HeadingContext: Context<ContextValue<HeadingContextProps> | null> =
  createContext<ContextValue<HeadingContextProps> | null>('brumate-ui:heading', null);

/** A Text gets its slot from its parent, such as "description" or "errorMessage". */
export const TextContext: Context<ContextValue<AttributeProps> | null> =
  createContext<ContextValue<AttributeProps> | null>('brumate-ui:text', null);

/** A field gives its Label an `id` and the `for` of its input. */
export const LabelContext: Context<ContextValue<AttributeProps> | null> =
  createContext<ContextValue<AttributeProps> | null>('brumate-ui:label', null);

export interface SeparatorContextProps extends AttributeProps {
  orientation?: 'horizontal' | 'vertical';
}

export const SeparatorContext: Context<ContextValue<SeparatorContextProps> | null> =
  createContext<ContextValue<SeparatorContextProps> | null>('brumate-ui:separator', null);

export interface GroupContextProps extends AttributeProps {
  isDisabled?: boolean;
  isInvalid?: boolean;
}

export const GroupContext: Context<ContextValue<GroupContextProps> | null> =
  createContext<ContextValue<GroupContextProps> | null>('brumate-ui:group', null);

/** The props of a Link that a context can give, such as Breadcrumbs for the current page. */
export interface LinkContextProps extends AttributeProps {
  isDisabled?: boolean;
  isCurrent?: boolean;
  onPress?: (event: PressEvent) => void;
}

export const LinkContext: Context<ContextValue<LinkContextProps> | null> =
  createContext<ContextValue<LinkContextProps> | null>('brumate-ui:link', null);

export interface ToggleButtonContextProps extends ButtonContextProps {
  isSelected?: boolean;
  onChange?: (selected: boolean) => void;
}

export const ToggleButtonContext: Context<ContextValue<ToggleButtonContextProps> | null> =
  createContext<ContextValue<ToggleButtonContextProps> | null>('brumate-ui:toggle-button', null);
