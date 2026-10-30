# Log: parser-closed-nesting

- Probe on main: the #364 repro `<p>T <!--b--><div>x</div><!--/b--></p>` parsed with parse5 gives `<p>T <!--b--></p><div>x</div><!--/b--><p></p>`. The work did not exist.
- Checked each rule of src/nesting.ts against parse5 with a document type (`<p><span><section>` splits; `<p><button><div>` stays; `<h1><h2>`, `<li><li>`, `<dd><dt>`, `<a>` in `<a>` through a `<div>`, `<form>` in `<form>` through a `<div>`, `<button><button>`, a `<div>` in `<table>`, `<tbody>` or `<tr>` all split or move).
- `<table>` inside `<p>` also closes it with a document type, but not in quirks mode, so it is left out of the rules.
- The server hint: `component()` gets a sixth argument, the text `<Name> in file:line:col`, only for a component that sits inside a `<p>` in button scope. Other calls are unchanged. Dev only since the coordinator decision below.
- Only `<p>` is checked in the server render. Components inside `<a>`, `<form>`, `<button>`, headings, `<li>` and tables are too common to mark every call, so those stay compile-time only.
- Dev check is an error (throw), not a warning: the browser throws "Missing end marker" for the same page, and a warning would be missed in the page of the dev server.
- Scan of every `.brm` outside fixtures and tests (520 files): 0 BRM185.
- The `.brm` fixtures under test/ were not scanned; the test suite compiles them.
- Coordinator decision: the hint is dev-only (`!plan.hideNames`); the server check stays `<p>` only.
