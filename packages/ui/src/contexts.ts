// The contexts of the part types. A part that holds other parts provides their props here, and
// each part reads its own with `slotProps`.
import { createContext } from 'brumate/context';
import type { Color } from './color.ts';
import type { ColorSchemeChoice } from './color-scheme.ts';
import type { Placement } from './position.ts';
import type { Context } from 'brumate/context';
import type { StoreLike } from 'brumate/store';
import type { HoverEvent, PressEvent } from './events.ts';
import type { ContextValue } from './slots.ts';

/** The handlers of a Button that a context can give. They are not in the store of the context. */
export interface ButtonHandlers {
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

/** The attributes and states of a Button that a context can give, which can change. */
export interface ButtonStateProps {
  isDisabled?: boolean;
  isPending?: boolean;
  [attribute: string]: unknown;
}

/** The props of a Button that a context can give: its state and its handlers. */
export interface ButtonContextProps extends ButtonStateProps, ButtonHandlers {}

/**
 * What a part gives its Buttons: the store of their attributes and states, and their handlers. Both
 * name the same slots. A part outside any gives no handler.
 */
export interface ButtonGiven {
  state: StoreLike<ContextValue<ButtonStateProps> | null>;
  handlers?: ContextValue<ButtonHandlers> | null;
}

export const ButtonContext: Context<ButtonGiven> = createContext<ButtonGiven>('brumate-ui:button');

/** The attributes of a part that a context can give, such as `id` or `aria-label`. */
export interface AttributeProps {
  [attribute: string]: unknown;
}

/** The props of a Heading that a context can give, such as the level. */
export interface HeadingContextProps extends AttributeProps {
  level?: number;
}

export const HeadingContext: Context<ContextValue<HeadingContextProps> | null> =
  createContext<ContextValue<HeadingContextProps> | null>('brumate-ui:heading');

/** A Text gets its slot from its parent, such as "description" or "errorMessage". */
export const TextContext: Context<StoreLike<ContextValue<AttributeProps> | null>> =
  createContext<StoreLike<ContextValue<AttributeProps> | null>>('brumate-ui:text');

/** A field gives its Label an `id` and the `for` of its input. */
export const LabelContext: Context<StoreLike<ContextValue<AttributeProps> | null>> =
  createContext<StoreLike<ContextValue<AttributeProps> | null>>('brumate-ui:label');

export interface SeparatorContextProps extends AttributeProps {
  orientation?: 'horizontal' | 'vertical';
}

export const SeparatorContext: Context<ContextValue<SeparatorContextProps> | null> =
  createContext<ContextValue<SeparatorContextProps> | null>('brumate-ui:separator');

export interface GroupContextProps extends AttributeProps {
  isDisabled?: boolean;
  isInvalid?: boolean;
}

export const GroupContext: Context<StoreLike<ContextValue<GroupContextProps> | null>> =
  createContext<StoreLike<ContextValue<GroupContextProps> | null>>('brumate-ui:group');

/** The handlers of a Link that a context can give. They are not in the store of the context. */
export type LinkHandlers = ButtonHandlers;

/** The attributes and states of a Link that a context can give, which can change. */
export interface LinkStateProps extends AttributeProps {
  isDisabled?: boolean;
  isCurrent?: boolean;
}

/** The props of a Link that a context can give, such as Breadcrumbs for the current page. */
export interface LinkContextProps extends LinkStateProps, LinkHandlers {}

/** What a part gives its Links: the store of their attributes and states, and their handlers. */
export interface LinkGiven {
  state: StoreLike<ContextValue<LinkStateProps> | null>;
  handlers?: ContextValue<LinkHandlers> | null;
}

export const LinkContext: Context<LinkGiven> = createContext<LinkGiven>('brumate-ui:link');

export interface ToggleButtonContextProps extends ButtonContextProps {
  isSelected?: boolean;
  onChange?: (selected: boolean) => void;
}

export const ToggleButtonContext: Context<ContextValue<ToggleButtonContextProps> | null> =
  createContext<ContextValue<ToggleButtonContextProps> | null>('brumate-ui:toggle-button');

/** The attributes of an Input or a TextArea that a field gives, such as `id`, `name` and `aria-describedby`. */
export interface InputContextProps extends AttributeProps {
  /** Enter keeps no default, so it sends no form, as in a search field. */
  isEnterPrevented?: boolean;
  /** Escape keeps no default, so it closes no dialog, as in a search field with text. */
  isEscapePrevented?: boolean;
}

/** The handlers that a field runs for its Input or TextArea. They never change. */
export interface InputHandlers {
  onChange?: (value: string) => void;
  onInvalid?: (message: string, first: boolean) => void;
  onKeyDown?: (key: string, event: KeyboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

/** What a field gives its Input or TextArea: the store of its attributes, and its handlers. */
export interface InputField extends InputHandlers {
  props: StoreLike<ContextValue<InputContextProps> | null>;
}

export const InputContext: Context<InputField> = createContext<InputField>('brumate-ui:input');

export const TextAreaContext: Context<InputField> =
  createContext<InputField>('brumate-ui:textarea');

/**
 * Attributes that a part around a field gives the input of the field, such as an Autocomplete
 * that names its collection. A TextField or a SearchField passes them on, and the Input or the
 * TextArea renders them under those of the field.
 */
export const FieldInputContext: Context<StoreLike<Record<string, unknown> | null>> =
  createContext<StoreLike<Record<string, unknown> | null>>('brumate-ui:field-input');

/** The state of the validation of a field, which its FieldError shows. */
export interface FieldErrorState {
  id: string;
  isInvalid: boolean;
  errors: string[];
  /** More attributes of the error, such as the role="alert" of a field of createForm. */
  attributes?: Record<string, unknown>;
}

export const FieldErrorContext: Context<StoreLike<FieldErrorState | null>> =
  createContext<StoreLike<FieldErrorState | null>>('brumate-ui:field-error');

/** How the fields of a form validate, and the errors of the server by the name of a field. */
export interface FormState {
  validationBehavior: 'native' | 'aria';
  validationErrors: Record<string, string | string[]>;
}

export const FormContext: Context<StoreLike<FormState | null>> =
  createContext<StoreLike<FormState | null>>('brumate-ui:form');

/**
 * True while a Fieldset or a Form is disabled. A field reads it with its own `isDisabled`, so a
 * disabled fieldset disables the fields inside it.
 */
export const DisabledContext: Context<StoreLike<boolean>> =
  createContext<StoreLike<boolean>>('brumate-ui:disabled');

/** What a CheckboxGroup gives its Checkboxes: its values. */
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
  /** True while a box shows a mixed state, such as the box that selects all rows of a Table. */
  isIndeterminate?: boolean;
}

/** What a Checkbox calls on its group. */
export interface CheckboxGroupHandlers {
  toggle: (value: string, checked: boolean) => void;
  onInvalid: (message: string) => void;
}

/** What a CheckboxGroup gives: the store of its state, and its handlers. Outside a group there is no handler. */
export interface CheckboxGroupGiven extends Partial<CheckboxGroupHandlers> {
  state: StoreLike<CheckboxGroupState | null>;
}

export const CheckboxGroupContext: Context<CheckboxGroupGiven> = createContext<CheckboxGroupGiven>(
  'brumate-ui:checkbox-group',
);

/** What a RadioGroup gives its Radios: its choice and states. */
export interface RadioGroupState {
  name: string;
  value: string | null;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  describedBy?: string;
}

/** What a Radio calls on its group. */
export interface RadioGroupHandlers {
  select: (value: string) => void;
  onInvalid: (message: string) => void;
}

/** What a RadioGroup gives: the store of its state, and its handlers. Outside a group there is no handler. */
export interface RadioGroupGiven extends Partial<RadioGroupHandlers> {
  state: StoreLike<RadioGroupState | null>;
}

export const RadioGroupContext: Context<RadioGroupGiven> =
  createContext<RadioGroupGiven>('brumate-ui:radio-group');

/** What a ToggleButtonGroup gives its ToggleButtons, which name themselves with `id`. */
export interface ToggleGroupState {
  selectionMode: 'single' | 'multiple';
  selectedKeys: string[];
  isDisabled: boolean;
}

/** What a ToggleButton calls on its group. */
export interface ToggleGroupHandlers {
  toggle: (id: string) => void;
}

/** What a ToggleButtonGroup gives: the store of its state, and its handler. Outside a group there is no handler. */
export interface ToggleGroupGiven extends Partial<ToggleGroupHandlers> {
  state: StoreLike<ToggleGroupState | null>;
}

/** True inside a Toolbar, so a toolbar inside it is a group. */
export const ToolbarContext: Context<boolean> = createContext<boolean>('brumate-ui:toolbar');

export const ToggleGroupContext: Context<ToggleGroupGiven> =
  createContext<ToggleGroupGiven>('brumate-ui:toggle-group');

/** What a Disclosure gives its DisclosurePanel. */
export interface DisclosurePanelState {
  id: string;
  triggerId: string;
  isExpanded: boolean;
  /** A disabled disclosure keeps its panel closed, also for find in page. */
  isDisabled: boolean;
}

/** What a DisclosurePanel calls on its disclosure. */
export interface DisclosurePanelHandlers {
  expand: () => void;
}

/** What a Disclosure gives: the store of its state, and its handler. Outside a disclosure there is no handler. */
export interface DisclosurePanelGiven extends Partial<DisclosurePanelHandlers> {
  state: StoreLike<DisclosurePanelState | null>;
}

export const DisclosurePanelContext: Context<DisclosurePanelGiven> =
  createContext<DisclosurePanelGiven>('brumate-ui:disclosure-panel');

/** What a DisclosureGroup gives its Disclosures, which name themselves with `id`. */
export interface DisclosureGroupState {
  expandedKeys: string[];
  isDisabled: boolean;
}

/** What a Disclosure calls on its group. */
export interface DisclosureGroupHandlers {
  toggle: (id: string) => void;
}

/** What a DisclosureGroup gives: the store of its state, and its handler. Outside a group there is no handler. */
export interface DisclosureGroupGiven extends Partial<DisclosureGroupHandlers> {
  state: StoreLike<DisclosureGroupState | null>;
}

export const DisclosureGroupContext: Context<DisclosureGroupGiven> =
  createContext<DisclosureGroupGiven>('brumate-ui:disclosure-group');

/** What a DialogTrigger gives its overlay: whether it is open, and the IDs that link them. */
export interface OverlayTriggerState {
  isOpen: boolean;
  triggerId: string;
  overlayId: string;
  /**
   * A preview, such as of a PreviewTrigger: the overlay is not modal, and focus stays where it
   * is when it opens.
   */
  isPreview?: boolean;
  /** The overlay is not modal, such as a submenu, whose parent menu stays usable. */
  isNonModal?: boolean;
  /** The placement that the trigger asks for, such as `end top` for a submenu. */
  placement?: Placement;
  /** False when focus stays where it is as the overlay opens, such as a submenu opened by hover. */
  autoFocus?: boolean;
  /**
   * The content stays in the page while the overlay is closed, out of sight, in an element with
   * the ID `${overlayId}-closed`. A Select reads its items there, for the keys of its Button.
   */
  keepsContent?: boolean;
  /** The IDs that name a Dialog in the overlay with no Heading of its own, such as of a DatePicker. */
  labelledBy?: string;
  /** The overlay opens at this point of the viewport, in place of next to the trigger, such as a context menu. */
  point?: { x: number; y: number };
}

/** What an overlay calls on its trigger. */
export interface OverlayTriggerHandlers {
  open: () => void;
  close: () => void;
}

/** What a trigger gives: the store of its state, and its handlers. Outside a trigger there is no handler. */
export interface OverlayTriggerGiven extends Partial<OverlayTriggerHandlers> {
  state: StoreLike<OverlayTriggerState | null>;
}

export const OverlayTriggerContext: Context<OverlayTriggerGiven> =
  createContext<OverlayTriggerGiven>('brumate-ui:overlay-trigger');

/** What a PopoverGroup gives the popovers inside it: the ID that marks its elements. */
export interface PopoverGroupGiven {
  id: string;
}

export const PopoverGroupContext: Context<PopoverGroupGiven | null> =
  createContext<PopoverGroupGiven | null>('brumate-ui:popover-group');

/** What an overlay gives the Dialog inside it: the IDs that name it. */
export interface DialogState {
  /** The IDs that name the Dialog when it has no Heading, from the trigger of the overlay. */
  labelledBy?: string;
}

/** What a Dialog calls on its overlay. */
export interface DialogHandlers {
  close: () => void;
}

/** What an overlay gives: the store of its state, and its handler. Outside an overlay there is no handler. */
export interface DialogGiven extends Partial<DialogHandlers> {
  state: StoreLike<DialogState | null>;
}

export const DialogContext: Context<DialogGiven> = createContext<DialogGiven>('brumate-ui:dialog');

/** Set inside a ModalOverlay, so the Modal inside renders only its box. */
export interface ModalOverlayState {
  close: () => void;
}

export const ModalOverlayContext: Context<ModalOverlayState | null> =
  createContext<ModalOverlayState | null>('brumate-ui:modal-overlay');

/** What a ColorSwatchPickerItem gives the ColorSwatch inside it: the color of the item. */
export interface ColorSwatchState {
  color: string;
}

export const ColorSwatchContext: Context<StoreLike<ColorSwatchState | null>> =
  createContext<StoreLike<ColorSwatchState | null>>('brumate-ui:color-swatch');

/**
 * What a ColorPicker gives the color parts inside it: its color. A part that the caller gave a
 * `value` keeps its own.
 */
export interface ColorPickerState {
  /** The color as text, in the format of the caller. */
  value: string;
  /** The color at full precision, which the parts edit. It follows `value` when that changes. */
  color: Color;
}

/** What a ColorPicker gives: the store of its color, and how to change it. */
export interface ColorPickerGiven {
  state: StoreLike<ColorPickerState | null>;
  /**
   * Sets the color. The picker writes it to `value` in the format of `value`, only when that is
   * another color, or writes `text` instead when it is given. It gives the color that the picker
   * shows after the write.
   */
  setValue?: (color: Color, text?: string) => Color;
}

export const ColorPickerContext: Context<ColorPickerGiven> =
  createContext<ColorPickerGiven>('brumate-ui:color-picker');

/** The color scheme that a ColorScheme gives: the choice, and `light` or `dark` once known. */
export interface ColorSchemeState {
  value: ColorSchemeChoice;
  resolved: 'light' | 'dark' | undefined;
}

export interface ColorSchemeGiven {
  state: StoreLike<ColorSchemeState | null>;
  /** Changes the choice, as a Button inside does. */
  setValue: (next: ColorSchemeChoice) => void;
}

export const ColorSchemeContext: Context<ColorSchemeGiven> =
  createContext<ColorSchemeGiven>('brumate-ui:color-scheme');
