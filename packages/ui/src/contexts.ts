// The contexts of the part types. A part that holds other parts provides their props here, and
// each part reads its own with `slotProps`.
import { createContext } from 'brumate/context';
import type { Placement } from './position.ts';
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
  onPressStart?: (event: PressEvent) => void;
  onPressEnd?: (event: PressEvent) => void;
  onPressUp?: (event: PressEvent) => void;
  onPressChange?: (pressed: boolean) => void;
  onHoverStart?: (event: HoverEvent) => void;
  onHoverEnd?: (event: HoverEvent) => void;
  onHoverChange?: (hovered: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
}

export const LinkContext: Context<ContextValue<LinkContextProps> | null> =
  createContext<ContextValue<LinkContextProps> | null>('brumate-ui:link', null);

export interface ToggleButtonContextProps extends ButtonContextProps {
  isSelected?: boolean;
  onChange?: (selected: boolean) => void;
}

export const ToggleButtonContext: Context<ContextValue<ToggleButtonContextProps> | null> =
  createContext<ContextValue<ToggleButtonContextProps> | null>('brumate-ui:toggle-button', null);

/**
 * The props of an Input or a TextArea that a field gives: its attributes, such as `id`, `name`
 * and `aria-describedby`, and handlers that the field runs.
 */
export interface InputContextProps extends AttributeProps {
  onChange?: (value: string) => void;
  onInvalid?: (message: string, first: boolean) => void;
  onKeyDown?: (key: string) => void;
  onBlur?: () => void;
}

export const InputContext: Context<ContextValue<InputContextProps> | null> =
  createContext<ContextValue<InputContextProps> | null>('brumate-ui:input', null);

export const TextAreaContext: Context<ContextValue<InputContextProps> | null> =
  createContext<ContextValue<InputContextProps> | null>('brumate-ui:textarea', null);

/** The state of the validation of a field, which its FieldError shows. */
export interface FieldErrorState {
  id: string;
  isInvalid: boolean;
  errors: string[];
  /** More attributes of the error, such as the role="alert" of a field of createForm. */
  attributes?: Record<string, unknown>;
}

export const FieldErrorContext: Context<FieldErrorState | null> =
  createContext<FieldErrorState | null>('brumate-ui:field-error', null);

/** How the fields of a form validate, and the errors of the server by the name of a field. */
export interface FormState {
  validationBehavior: 'native' | 'aria';
  validationErrors: Record<string, string | string[]>;
}

export const FormContext: Context<FormState | null> = createContext<FormState | null>(
  'brumate-ui:form',
  null,
);

/** What a CheckboxGroup gives its Checkboxes: its values, and a function that toggles one. */
export interface CheckboxGroupState {
  name?: string;
  value: string[];
  isDisabled: boolean;
  isReadOnly: boolean;
  isInvalid: boolean;
  /** True while the group needs a box checked and has none, so the browser checks it. */
  isRequired: boolean;
  /** The ID of the error of the group, which each box names in aria-describedby. */
  describedBy?: string;
  toggle: (value: string, checked: boolean) => void;
  onInvalid: (message: string) => void;
}

export const CheckboxGroupContext: Context<CheckboxGroupState | null> =
  createContext<CheckboxGroupState | null>('brumate-ui:checkbox-group', null);

/** What a RadioGroup gives its Radios. */
export interface RadioGroupState {
  name: string;
  value: string | null;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  describedBy?: string;
  select: (value: string) => void;
  onInvalid: (message: string) => void;
}

export const RadioGroupContext: Context<RadioGroupState | null> =
  createContext<RadioGroupState | null>('brumate-ui:radio-group', null);

/** What a ToggleButtonGroup gives its ToggleButtons, which name themselves with `id`. */
export interface ToggleGroupState {
  selectionMode: 'single' | 'multiple';
  selectedKeys: string[];
  isDisabled: boolean;
  toggle: (id: string) => void;
}

export const ToggleGroupContext: Context<ToggleGroupState | null> =
  createContext<ToggleGroupState | null>('brumate-ui:toggle-group', null);

/** What a Disclosure gives its DisclosurePanel. */
export interface DisclosurePanelState {
  id: string;
  triggerId: string;
  isExpanded: boolean;
  expand: () => void;
}

export const DisclosurePanelContext: Context<DisclosurePanelState | null> =
  createContext<DisclosurePanelState | null>('brumate-ui:disclosure-panel', null);

/** What a DisclosureGroup gives its Disclosures, which name themselves with `id`. */
export interface DisclosureGroupState {
  expandedKeys: string[];
  isDisabled: boolean;
  toggle: (id: string) => void;
}

export const DisclosureGroupContext: Context<DisclosureGroupState | null> =
  createContext<DisclosureGroupState | null>('brumate-ui:disclosure-group', null);

/** What a DialogTrigger gives its overlay: whether it is open, and the IDs that link them. */
export interface OverlayTriggerState {
  isOpen: boolean;
  triggerId: string;
  overlayId: string;
  open: () => void;
  close: () => void;
  /**
   * A preview, such as of a PreviewTrigger: the overlay is not modal, and focus stays where it
   * is when it opens.
   */
  isPreview?: boolean;
  /** The overlay is not modal, such as a submenu, whose parent menu stays usable. */
  isNonModal?: boolean;
  /** The placement that the trigger asks for, such as `end top` for a submenu. */
  placement?: Placement;
}

export const OverlayTriggerContext: Context<OverlayTriggerState | null> =
  createContext<OverlayTriggerState | null>('brumate-ui:overlay-trigger', null);

/** What an overlay gives the Dialog inside it: the function that closes the overlay. */
export interface DialogState {
  close: () => void;
}

export const DialogContext: Context<DialogState | null> = createContext<DialogState | null>(
  'brumate-ui:dialog',
  null,
);

/** Set inside a ModalOverlay, so the Modal inside renders only its box. */
export interface ModalOverlayState {
  close: () => void;
}

export const ModalOverlayContext: Context<ModalOverlayState | null> =
  createContext<ModalOverlayState | null>('brumate-ui:modal-overlay', null);
