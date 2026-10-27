# Change request: element-types, three attributes

- From node: element-checks
- Status: proposed

## Problem

The stricter check reports three attributes that the repository writes and `Elements` lacks:

- `autocorrect` (global HTML attribute): packages/ui/src/DateSegment.brm writes `autocorrect="off"`. The runtime already treats it as an on/off switch (html.ts).
- `webkitdirectory` on `input`: packages/ui/src/FileTrigger.brm writes it for `acceptDirectory`. Browsers support it; it is in the File and Directory Entries spec, not HTML.
- `focusable` on `svg`: website/src/components/Icon.brm writes `focusable="false"`. It is SVG Tiny 1.2, for old Edge and IE.

## Proposed change

Add `autocorrect?: Attr<boolean | 'on' | 'off'>` to `GlobalAttributes` and `webkitdirectory?: Attr<boolean>` to `input`. Leave `focusable` out, and drop it from Icon.brm, or add it to the SVG list. The node missing-attributes already plans `autocorrect`.

## Affected nodes

element-checks, missing-attributes.

## Workaround in place

Each attribute is written as a spread of an object cast to `{}`, such as `{...({ autocorrect: 'off' } as {})}`, which renders the same attribute and skips the check. Revert each to a plain attribute once the types have it.
