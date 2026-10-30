// The pages of the section of @brumate/ui, from the Markdown files in `website/ui`, and the
// demos that they show, from `website/ui/demos`.

import type { Component } from 'brumate/server';
import type { Page } from '../plugins/markdown.ts';

const files = import.meta.glob<Page>('../ui/*.md', { eager: true, import: 'default' });

/** The pages, by their path after `/ui/`. */
export const pages: Record<string, Page> = Object.create(null);
for (const [file, page] of Object.entries(files)) {
  const name = /([\w-]+)\.md$/.exec(file)![1]!;
  pages[name === 'index' ? '' : name] = page;
}

/** The demos, by their name, such as `PressDemo` for `demos/PressDemo.brm`. */
export const demos: Record<string, Component> = Object.create(null);
for (const [file, demo] of Object.entries(
  import.meta.glob<Component>('../ui/demos/*.brm', { eager: true, import: 'default' }),
)) {
  demos[/(\w+)\.brm$/.exec(file)![1]!] = demo;
}

const groups = [
  {
    title: 'Start',
    pages: ['introduction', 'styling', 'state', 'resuming', 'layers', 'influences'],
  },
  {
    title: 'Buttons',
    pages: ['button', 'toggle-button', 'toggle-button-group', 'link', 'file-trigger', 'drop-zone'],
  },
  {
    title: 'Forms',
    pages: [
      'text-field',
      'search-field',
      'token-field',
      'number-field',
      'slider',
      'checkbox',
      'checkbox-group',
      'radio-group',
      'switch',
      'form',
    ],
  },
  {
    title: 'Colors',
    pages: [
      'color-picker',
      'color-swatch',
      'color-slider',
      'color-area',
      'color-wheel',
      'color-field',
      'color-swatch-picker',
    ],
  },
  {
    title: 'Dates',
    pages: ['calendar', 'range-calendar', 'date-field', 'time-field', 'date-picker'],
  },
  {
    title: 'Overlays',
    pages: ['dialog', 'popover', 'modal', 'sheet', 'tooltip', 'preview-trigger', 'toast'],
  },
  {
    title: 'Collections',
    pages: [
      'list-box',
      'grid-list',
      'menu',
      'select',
      'combo-box',
      'autocomplete',
      'tabs',
      'tag-group',
      'selection-indicator',
    ],
  },
  { title: 'Data', pages: ['table', 'tree', 'navigation-tree', 'virtualizer', 'data'] },
  { title: 'Navigation', pages: ['disclosure', 'disclosure-group', 'breadcrumbs', 'toolbar'] },
  { title: 'Status', pages: ['meter', 'progress-bar'] },
  { title: 'Layout', pages: ['group', 'separator', 'heading'] },
  { title: 'Animation', pages: ['transition'] },
  { title: 'Utilities', pages: ['visually-hidden', 'keyboard', 'i18n-provider'] },
];

/** The sections of the sidebar, in reading order. Each part has a page of its own. */
export const sections: { title: string; pages: { slug: string; title: string }[] }[] = [];
for (const group of groups) {
  const entries: { slug: string; title: string }[] = [];
  for (const slug of group.pages) {
    if (slug in pages) {
      entries.push({
        slug,
        title: pages[slug]!.title,
      });
    }
  }
  sections.push({ title: group.title, pages: entries });
}

/** The cards of the home of the section: a demo of each part, and the section about it. */
export const gallery: { title: string; summary: string; href: string; demo: string }[] = [
  {
    title: 'Button',
    summary: 'Presses with a pointer, a key or a screen reader.',
    href: 'button',
    demo: 'ButtonDemo',
  },
  {
    title: 'ToggleButton',
    summary: 'A button that stays pressed.',
    href: 'toggle-button',
    demo: 'ToggleButtonDemo',
  },
  {
    title: 'ToggleButtonGroup',
    summary: 'Toggle buttons with one selection or several.',
    href: 'toggle-button-group',
    demo: 'ToggleButtonGroupDemo',
  },
  {
    title: 'Link',
    summary: 'A link that presses as a button does.',
    href: 'link',
    demo: 'LinkDemo',
  },
  {
    title: 'FileTrigger',
    summary: 'Opens the file picker from a button.',
    href: 'file-trigger',
    demo: 'FileTriggerDemo',
  },
  {
    title: 'DropZone',
    summary: 'An area that takes drops and pastes of text and files.',
    href: 'drop-zone',
    demo: 'DropZoneDemo',
  },
  {
    title: 'TextField',
    summary: 'A labeled input, checked by the browser.',
    href: 'text-field',
    demo: 'TextFieldDemo',
  },
  {
    title: 'SearchField',
    summary: 'A search input that Escape clears.',
    href: 'search-field',
    demo: 'SearchFieldDemo',
  },
  {
    title: 'Checkbox',
    summary: 'A native checkbox, with a box of your own.',
    href: 'checkbox',
    demo: 'CheckboxDemo',
  },
  {
    title: 'CheckboxGroup',
    summary: 'Checkboxes with one value.',
    href: 'checkbox-group',
    demo: 'CheckboxGroupDemo',
  },
  {
    title: 'RadioGroup',
    summary: 'Native radios that the arrow keys move.',
    href: 'radio-group',
    demo: 'RadioGroupDemo',
  },
  {
    title: 'Switch',
    summary: 'A setting that applies at once.',
    href: 'switch',
    demo: 'SwitchDemo',
  },
  {
    title: 'Form',
    summary: 'Validation, and the errors of the server.',
    href: 'form',
    demo: 'FormDemo',
  },
  {
    title: 'Dialog',
    summary: 'The content of an overlay, named by its title.',
    href: 'dialog',
    demo: 'DialogDemo',
  },
  {
    title: 'Popover',
    summary: 'An overlay beside its trigger, with layers inside.',
    href: 'popover',
    demo: 'PopoverDemo',
  },
  {
    title: 'Modal',
    summary: 'A dialog over the page, which it locks.',
    href: 'modal',
    demo: 'ModalDemo',
  },
  {
    title: 'Sheet',
    summary: 'A modal along an edge of the window.',
    href: 'sheet',
    demo: 'SheetDemo',
  },
  {
    title: 'Tooltip',
    summary: 'A short description of a button, on hover and focus.',
    href: 'tooltip',
    demo: 'TooltipDemo',
  },
  {
    title: 'PreviewTrigger',
    summary: 'A preview of a link, on hover, focus and a long press.',
    href: 'preview-trigger',
    demo: 'PreviewTriggerDemo',
  },
  {
    title: 'Toast',
    summary: 'A notice that comes and goes, in a landmark.',
    href: 'toast',
    demo: 'ToastDemo',
  },
  {
    title: 'NumberField',
    summary: 'A field for a number, in the format of the locale.',
    href: 'number-field',
    demo: 'NumberFieldDemo',
  },
  {
    title: 'Slider',
    summary: 'A value, or a range of values, on a track.',
    href: 'slider',
    demo: 'SliderDemo',
  },
  {
    title: 'ColorPicker',
    summary: 'One color, shared by the color parts inside it.',
    href: 'color-picker',
    demo: 'ColorPickerDemo',
  },
  {
    title: 'ColorSwatch',
    summary: 'A sample of a color, named for screen readers.',
    href: 'color-swatch',
    demo: 'ColorSwatchDemo',
  },
  {
    title: 'ColorSlider',
    summary: 'A slider for one channel of a color.',
    href: 'color-slider',
    demo: 'ColorSliderDemo',
  },
  {
    title: 'ColorArea',
    summary: 'Two channels of a color on a plane.',
    href: 'color-area',
    demo: 'ColorAreaDemo',
  },
  {
    title: 'ColorWheel',
    summary: 'A circular track for the hue of a color.',
    href: 'color-wheel',
    demo: 'ColorWheelDemo',
  },
  {
    title: 'ColorField',
    summary: 'A field for a color, as hex or as one channel.',
    href: 'color-field',
    demo: 'ColorFieldDemo',
  },
  {
    title: 'ColorSwatchPicker',
    summary: 'A list of color swatches, to pick one.',
    href: 'color-swatch-picker',
    demo: 'ColorSwatchPickerDemo',
  },
  {
    title: 'Calendar',
    summary: 'The days of a month, to pick a date.',
    href: 'calendar',
    demo: 'CalendarDemo',
  },
  {
    title: 'RangeCalendar',
    summary: 'The days of a month, to pick a range of dates.',
    href: 'range-calendar',
    demo: 'RangeCalendarDemo',
  },
  {
    title: 'DateField',
    summary: 'A date that the user types segment by segment.',
    href: 'date-field',
    demo: 'DateFieldDemo',
  },
  {
    title: 'TimeField',
    summary: 'A time of day that the user types segment by segment.',
    href: 'time-field',
    demo: 'TimeFieldDemo',
  },
  {
    title: 'DatePicker',
    summary: 'A date field with a button that opens a calendar.',
    href: 'date-picker',
    demo: 'DatePickerDemo',
  },
  {
    title: 'DateRangePicker',
    summary: 'Two date fields and a button that opens a range calendar.',
    href: 'date-range-picker',
    demo: 'DateRangePickerDemo',
  },
  {
    title: 'ListBox',
    summary: 'A list of options to select, by keyboard and pointer.',
    href: 'list-box',
    demo: 'ListBoxDemo',
  },
  {
    title: 'Menu',
    summary: 'Actions and options that open from a button, with submenus.',
    href: 'menu',
    demo: 'MenuDemo',
  },
  {
    title: 'Select',
    summary: 'A field that picks one item from a list.',
    href: 'select',
    demo: 'SelectDemo',
  },
  {
    title: 'ComboBox',
    summary: 'A text field with a list of suggestions that filters as you type.',
    href: 'combo-box',
    demo: 'ComboBoxDemo',
  },
  {
    title: 'Autocomplete',
    summary: 'A search field that filters a menu or a list next to it.',
    href: 'autocomplete',
    demo: 'AutocompleteDemo',
  },
  {
    title: 'Tabs',
    summary: 'Tabs that show one panel at a time.',
    href: 'tabs',
    demo: 'TabsDemo',
  },
  {
    title: 'TagGroup',
    summary: 'Tags that the user can select and remove.',
    href: 'tag-group',
    demo: 'TagGroupDemo',
  },
  {
    title: 'GridList',
    summary: 'Rows with buttons and checkboxes, to select and act on.',
    href: 'grid-list',
    demo: 'GridListDemo',
  },
  {
    title: 'Table',
    summary: 'Rows and columns that the user can select and sort.',
    href: 'table',
    demo: 'TableDemo',
  },
  {
    title: 'Tree',
    summary: 'Rows that nest and open and close, such as files in folders.',
    href: 'tree',
    demo: 'TreeDemo',
  },
  {
    title: 'NavigationTree',
    summary: 'A tree of links that shows the page that the user is on.',
    href: 'navigation-tree',
    demo: 'NavigationTreeDemo',
  },
  {
    title: 'TokenField',
    summary: 'Text with mentions and tags that the user types.',
    href: 'token-field',
    demo: 'TokenFieldDemo',
  },
  {
    title: 'Virtualizer',
    summary: 'Thousands of rows that render as they come into view.',
    href: 'virtualizer',
    demo: 'VirtualizerDemo',
  },
  {
    title: 'List and tree data',
    summary: 'Items that an app adds, moves and removes, with their selection.',
    href: 'data',
    demo: 'DataDemo',
  },
  {
    title: 'SelectionIndicator',
    summary: 'A mark of the selected item, which moves with the selection.',
    href: 'selection-indicator',
    demo: 'SelectionIndicatorDemo',
  },
  {
    title: 'Disclosure',
    summary: 'A section that expands and collapses.',
    href: 'disclosure',
    demo: 'DisclosureDemo',
  },
  {
    title: 'DisclosureGroup',
    summary: 'Disclosures that open one at a time.',
    href: 'disclosure-group',
    demo: 'DisclosureGroupDemo',
  },
  {
    title: 'Breadcrumbs',
    summary: 'A trail to the current page.',
    href: 'breadcrumbs',
    demo: 'BreadcrumbsDemo',
  },
  {
    title: 'Toolbar',
    summary: 'The arrow keys move between its items.',
    href: 'toolbar',
    demo: 'ToolbarDemo',
  },
  {
    title: 'Meter',
    summary: 'A value in a known range, in the locale.',
    href: 'meter',
    demo: 'MeterDemo',
  },
  {
    title: 'ProgressBar',
    summary: 'The progress of a task.',
    href: 'progress-bar',
    demo: 'ProgressBarDemo',
  },
  { title: 'Group', summary: 'Parts that belong together.', href: 'group', demo: 'GroupDemo' },
  {
    title: 'Separator',
    summary: 'A line between two parts of the content.',
    href: 'separator',
    demo: 'SeparatorDemo',
  },
  {
    title: 'Transition',
    summary: 'Animates content as it comes and goes.',
    href: 'transition',
    demo: 'TransitionDemo',
  },
  {
    title: 'VisuallyHidden',
    summary: 'Content for screen readers alone.',
    href: 'visually-hidden',
    demo: 'VisuallyHiddenDemo',
  },
  { title: 'Keyboard', summary: 'A keyboard shortcut.', href: 'keyboard', demo: 'KeyboardDemo' },
  {
    title: 'I18nProvider',
    summary: 'A locale and its direction for the parts.',
    href: 'i18n-provider',
    demo: 'I18nProviderDemo',
  },
];
