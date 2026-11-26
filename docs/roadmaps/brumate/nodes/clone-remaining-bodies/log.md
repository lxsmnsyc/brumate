# Log: clone-remaining-bodies

- Base: batch/brumate-release-0.10 at 25d4c5f6. `clone-bodies.test.ts` passed with 20 `HTML_BODIES`; `$$b.raw(` still returned by `emitTemplate` (markup.ts). Not fulfilled.
- Base todos: `pnpm bench --only brumate --scenario todos` gives JS before `load` 5 files, 35.3 kB / 14.6 kB gzip (load average 7, noisy).
- Done: `#try` in the browser renders `$$b.tryNodes(body, catch, 1?)` (waits.ts, markup.ts `emitTryNodes`). Windowed `#for` through `listNodes` with a slice (`emitWindowNodes`). `#offscreen` through `offscreenNodes` (templates.ts). The cloner accepts `makeId` lines and `})();` between the writes (template.ts).
- `keep` writes `b-b` on an element with `b-client` too: the window's `<template>` is not at the top of the clone, and its loader reads `b-b`.
- Template fragment return tried and dropped: `emitTemplate` cloned and returned `$$b.rawNodes($$f, scope)` (a `TemplateNodes` class, `insert` holds its place, `clientHTML` on when it is used). Constants in `withTemplates` needed `sharedTemplate` (they land in another part). 64 tests failed first, 8 in resume.test.ts after fixing the constants: in-place template updates (`tplInPlaceHost`, 15 scopes instead of 11, so scopes of cloned template output leak or the in-place match fails), `gapTemplate`, `tryTemplateProp`, `tryTemplateNested`. Reverted, not committed.
- Load: the full run on this machine (load 17 to 18) times out many tests; each failing file passes alone.
