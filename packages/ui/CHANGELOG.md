# @brumate/ui

## 0.1.0

### Minor Changes

- c6134ea: @brumate/ui is published to npm, under the MIT License. It takes brumate as a peer dependency. It has parts for buttons, forms, collections, data, colors, dates, overlays, navigation, status, layout, animation and utilities.
- 54d4852: Every part exports its props type from `<script module>`, such as `ButtonProps` from `Button.brm`. The parts that render an element take `as`, the name of an element or a component, and the other props are those of the target, so `<Button as="a" href="/docs">` is valid and `<Button as="a" foo>` is an error. They forward `ref`, and the signal is typed from the target: `<Button ref=$bind(b)>` gives `HTMLButtonElement | undefined`, and `<Button as="a" ref=$bind(link)>` gives `HTMLAnchorElement | undefined`. `@brumate/ui/as.ts` has the types `AsProps` and `AsTarget` for a part of your own.
- e92ffd3: `GridList`, `ListBox` and `Table` take `items`, as `Tree` does, and render each with an `item` template. With `rowHeight`, or in a `Virtualizer`, they render only the rows in view, and their keys read the data of all the items. Home, End, the page keys, Ctrl+A, the box in the header of a `Table`, ranges with Shift and letters reach rows that are out of view, and a move to one scrolls it into view, then focuses it. `getTextValue` gives the text of an item for letters.
- 789a184: The date parts speak the language of the I18nProvider. The placeholders of the segments follow what browsers show in their date inputs (`tt.mm.jjjj` in German), the segment names come from `Intl.DisplayNames`, and the labels of the Calendar and the DatePicker have a table for English, German, French, Spanish, Japanese and Chinese. An I18nProvider takes `strings` to replace the whole set, and `timeZone`. The server writes only the strings of its language into the page. Today follows `timeZone` of the Calendar or the I18nProvider.
- b1e8aca: Drag and drop. A `DropZone` takes drops and pastes of text and files. The rows of a `GridList` move with a drag of the pointer or from the keys with `onReorder`, and drag out to a DropZone with `getItems`. Every module of the package can be imported, such as `@brumate/ui/data.ts`.
- 457a4d9: ListBox, GridList, Table, TableBody, Tree, TreeRow and NavigationTree take a type `V` for their items, so `item` and `getTextValue` get the type of `items` and a wrong field is an error. ToastRegion takes `V` for the content of a toast. The props types take the value first, then the target: `ListBoxProps<V, T>`.
- 4b77183: A skill for the parts, `skills/brumate-ui`, ships in the package. It has a `SKILL.md` and references for composition, slots and contexts, state with `$bind`, `as` and `ref`, templates, `data-*` styling, collections, overlays, dates and colors, and i18n. To use it, copy it into the skills of a project: `cp -r node_modules/@brumate/ui/skills/brumate-ui .claude/skills/`.

### Patch Changes

- Updated dependencies [859f9b9]
- Updated dependencies [fdc0e73]
- Updated dependencies [2f62fba]
- Updated dependencies [c519c4a]
- Updated dependencies [14ced48]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [296a8ce]
- Updated dependencies [f80f134]
- Updated dependencies [393688f]
- Updated dependencies [c251b27]
- Updated dependencies [54d4852]
- Updated dependencies [d939be1]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [b4faafb]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [043532f]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [9b476e6]
- Updated dependencies [6405647]
- Updated dependencies [54d4852]
- Updated dependencies [3cd7155]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [95504b2]
- Updated dependencies [88b9ac7]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [67a64f7]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [39f4baf]
- Updated dependencies [3b451bb]
  - brumate@0.4.0
