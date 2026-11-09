# Log: popover-sizing

- Nothing existed yet: only `--available-height` was set. Added `fitHeight` option to followTrigger (Popover only, Tooltip untouched), `readLength` and `parseLength`.
- Author max-height: an inline value that is not the one we wrote stays. A stylesheet value is found by clearing ours and reading the computed style.
- Anchor vars are read once when the popover opens, with `$isPassed` for each prop.
- Doubt: happy-dom returns '' for unset computed max-height, so the check accepts '' and 'none'. Not run in a real browser.
