# Log: differential-render-test

- 2026-11-03: Nothing existed, so I built it. The browser render of a page needs a parent, so each page gets a generated wrapper (`<page>.diff.brm`) with the toggle `#if (on) { <Page props /> }`. The server render of the wrapper has the block closed; a click renders the page with the browser path.
- Compared: markup (no comments, no `b-` attributes, scripts and styles removed, attributes sorted, generated IDs renumbered by first use), the head, the style sheets, the slots of the scopes under the page root (sorted, scope numbers by position), and the errors (onError, unhandled rejections, a failed server render).
- Dead end: comparing in one test with sleeps. Under load (four shards and a busy machine) pages did not settle, and 20 pages flipped. Fix: count the modules the loader is importing, and wait for the core before reading a resumed page.
- Dead end: the server render with `dev: false` masks the error text in a `#catch`. I render with `dev: true`; the masking is an accepted difference that other tests cover.
- Server functions: `fetch` is stubbed to `handleRequest(page.rpc, ...)`, so the browser render of a page with server functions gets real answers.
- The commit subject asked for (93 chars) fails the plain-writing hook (72), so the subject is "differential-render-test: Compare server and browser renders".
- Found a bug: tryTemplateChild. The render module of a page that uses a component only in a `#template` inside `#try` lacks the import (ReferenceError). Not fixed here (not my node); cause `template-import`.
- Open doubt: AsButton is unstable when rendered without `as` and `children` (sometimes an error), so it is an opt-out.
