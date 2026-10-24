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

/** The sections of the sidebar, in reading order. Each part has a page of its own. */
export const sections: { title: string; pages: { slug: string; title: string }[] }[] = [
  { title: 'Start', pages: ['', 'styling', 'state', 'resuming', 'layers', 'influences'] },
  {
    title: 'Buttons',
    pages: ['button', 'toggle-button', 'toggle-button-group', 'link', 'file-trigger'],
  },
  {
    title: 'Forms',
    pages: [
      'text-field',
      'search-field',
      'checkbox',
      'checkbox-group',
      'radio-group',
      'switch',
      'form',
    ],
  },
  {
    title: 'Overlays',
    pages: ['dialog', 'popover', 'modal', 'sheet', 'tooltip', 'preview-trigger', 'toast'],
  },
  { title: 'Collections', pages: ['list-box', 'menu', 'select'] },
  { title: 'Navigation', pages: ['disclosure', 'disclosure-group', 'breadcrumbs', 'toolbar'] },
  { title: 'Status', pages: ['meter', 'progress-bar'] },
  { title: 'Layout', pages: ['group', 'separator', 'heading'] },
  { title: 'Animation', pages: ['transition'] },
  { title: 'Utilities', pages: ['visually-hidden', 'keyboard', 'i18n-provider'] },
].map((section) => ({
  title: section.title,
  pages: section.pages
    .filter((slug) => slug in pages)
    .map((slug) => ({ slug, title: slug === '' ? 'Introduction' : pages[slug]!.title })),
}));

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
