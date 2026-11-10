# Log: devtools-copy

- Checked first: only the server call and Issues had a Copy button (Issues copied plain text, no feedback). Inspect and Activity had none.
- Moved cutLong, printValue, writeForAgent and the clipboard helper from call-detail.ts into copy.ts, with the new formatters. Updated the import of the call-detail test.
- Values pass through `toPlain`, which now blanks keys named cookie, headers and authorization, and prints functions and elements short. Each text also goes through `scrub`, which blanks `Cookie:`, `Set-Cookie:` and `Authorization:` lines.
- Handler run: Activity has no detail pane for it, so each handler row gets an icon button that shows on hover or focus.
- Not browser-checked by the worker.
