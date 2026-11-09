// The sections of the sidebar and the kinds on the landing page of @brumate/ui: the pages of
// each group, by their name in `website/ui`. A page belongs to one group. A page outside
// `Start` is a part, and its card reads the `summary` in the front matter of the page.

export const groups: { title: string; pages: string[] }[] = [
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
      'fieldset',
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
    pages: [
      'calendar',
      'range-calendar',
      'date-field',
      'time-field',
      'date-picker',
      'date-range-picker',
    ],
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
