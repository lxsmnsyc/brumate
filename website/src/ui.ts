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

/** The sections of the sidebar, in reading order. */
export const sections: { title: string; pages: { slug: string; title: string }[] }[] = [
  { title: 'Start', pages: ['', 'styling', 'state', 'resuming', 'influences'] },
  { title: 'Parts', pages: ['buttons', 'fields', 'boxes', 'structure', 'status', 'utilities'] },
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
    href: 'buttons#button',
    demo: 'PressDemo',
  },
  {
    title: 'ToggleButton',
    summary: 'Stays pressed, alone or in a group.',
    href: 'buttons#togglebutton-and-togglebuttongroup',
    demo: 'ToggleDemo',
  },
  {
    title: 'Link',
    summary: 'A link with a current and a disabled state.',
    href: 'buttons#link',
    demo: 'LinkDemo',
  },
  {
    title: 'TextField',
    summary: 'A label, an input, a description and its errors.',
    href: 'fields#textfield',
    demo: 'TextFieldDemo',
  },
  {
    title: 'SearchField',
    summary: 'Enter searches, Escape clears.',
    href: 'fields#searchfield',
    demo: 'SearchDemo',
  },
  {
    title: 'Checkbox',
    summary: 'A native box, with an indeterminate state.',
    href: 'boxes#checkbox',
    demo: 'CheckboxDemo',
  },
  {
    title: 'CheckboxGroup',
    summary: 'Boxes with one list of values.',
    href: 'boxes#checkboxgroup',
    demo: 'CheckboxGroupDemo',
  },
  {
    title: 'RadioGroup',
    summary: 'Native radios that the arrow keys move.',
    href: 'boxes#radiogroup-and-radio',
    demo: 'RadioDemo',
  },
  {
    title: 'Switch',
    summary: 'A setting that applies at once.',
    href: 'boxes#switch',
    demo: 'SwitchDemo',
  },
  {
    title: 'Toolbar',
    summary: 'The arrow keys move focus, Tab leaves it.',
    href: 'structure#toolbar',
    demo: 'ToolbarDemo',
  },
  {
    title: 'Group',
    summary: 'Parts that belong together.',
    href: 'structure#group',
    demo: 'GroupDemo',
  },
  {
    title: 'Breadcrumbs',
    summary: 'A trail to the current page.',
    href: 'structure#breadcrumbs',
    demo: 'BreadcrumbsDemo',
  },
  {
    title: 'Meter and ProgressBar',
    summary: 'A value in a range, in the locale.',
    href: 'status',
    demo: 'MeterDemo',
  },
  {
    title: 'FileTrigger',
    summary: 'Opens the file picker from a button.',
    href: 'buttons#filetrigger',
    demo: 'FileTriggerDemo',
  },
  {
    title: 'Utilities',
    summary: 'VisuallyHidden, Keyboard and I18nProvider.',
    href: 'utilities',
    demo: 'UtilitiesDemo',
  },
];
