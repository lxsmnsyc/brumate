# Review: state-dedupe-spike

Fresh review of the prototype (d76ef9ef on base 1f328c06), 2026-11-26.

## Verdict

The measurement holds and reproduces. The safety rule does not hold as built, so the outcome's go needs the fixes below in the build node. With them the node is M+ or L, not M.

## Gates

- Gate 1 (same HTML on every path): does not hold. Two cases fail where the base works, and one path was not tested for real (findings 1 and 2).
- Gate 2 (navigation gzip): holds. Rebuilt on both sides: `/docs/context` 33 366 to 26 556 B (-20.4%), `/ui/dialog` 43 089 to 35 667 B (-17.2%), `/` +0.2%. The fixes below should not change these, since the website's large values print inside `<div>` and `<article>`.
- Gate 3 (suite): holds; failures under load pass on a rerun.
- todos: +256 B gzip JS before `load` (14 924 to 15 180 B). The brief records size and has no size gate.
- Case B: agreed; nothing changes, and cutting rows to keys needs a compiler rule.

## Findings

1. Blocking: `printable()` in `codegen/markup.ts` treats an unknown parent as safe. An insert at a component root, in a children body or in `#head` is marked even when the caller puts it in `<a>`, `<template>`, `<p>`, `<li>`, `<button>` or a table part. Reproduced: `<Link>{page.body}</Link>` inside a `#key` (Link renders `<a>{children}</a>`) and `<template><Wrap doc=page.body/></template>` throw `The page has no printed HTML` at resume; the base resumes. Fix: pass a "printable here" bit at the call site, or don't mark inserts whose parent is unknown; never mark in `#head`.
2. Blocking: a navigation that keeps a layout throws. `replaceRoutes` moves only the replaced regions, then appends every state record, and the core decodes every `$b.d` before `routeRecord` filters out the kept layouts' scopes (`runtime/client/resume.ts:113`, `:129`; `runtime/navigate.ts:307-345`). Reproduced in a simulation of `replaceRoutes`. Gate 1's navigation test appended the whole page, so it missed this. Fix: read the ranges from the fetched document before it is dropped, or decode `$b.d` lazily.
3. Should fix: read-back isn't exact for `<pre>`, `<textarea>` and `<listing>` text that starts with a newline (one newline lost per re-render, Chrome), or for declarative shadow roots. `balanced()` should refuse these.
4. Should fix: markers stay in the DOM when the record has no `$b.d` (12 on `/`), the cause of the home page's +31 B.
5. Design: the compiler can't tell raw HTML from text, so pruning keys on "the app has a marked insert". todos would pay 0 B, but most apps would carry the decoder.
6. Not checked: extensions that change the DOM while it parses would be read into the value.

The probes are kept in the reviewer's scratchpad, not in the repo; the build node writes them as tests (InChildren, InTemplate, a kept layout through the real `replaceRoutes`, `<pre>`).
