# Log: no-html-string-fallback

- 11-03 Counted the fallbacks first: 223 `return $$html` in the client code of the render pages (test/render), 43 more `$$b.raw`. Causes: (1) `emitRender` cloned only `#if`, `#for` and `#loading` bodies; (2) a `<template>` or other comment made `clonedTemplate` give up; (3) a `#client` block with no fill call (`missing`); (4) inline `#try`, windowed `#for`, `#offscreen`, waits in scripts, `#template` functions, children closures.
- Fixed 1-3: every block kind clones its body; templates with `<template>` or comments carry a flag (`$$b.template(html, n, foreign, 1)`) so the insert of each clone indexes markers and starts the `<template>` elements (the parse of the template no longer starts them); a block with no fill keeps its markers (`markBlock`); `portalTo` takes a fragment.
- Left (4): 19 bodies in the pages plus all `#template` functions and children closures. Listed in test/clone-bodies.test.ts.
