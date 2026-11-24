---
'brumate': minor
---

- `$signal`, `$memo`, `$gate`, `$debounced`, `$throttled`, `$optimistic` and `$untrack` work at the top level of a `.brm.ts` module and of `<script module>`.
- Each module value is shared by every importer. Components read it like their own values.
- Components write a module signal only through functions that the module exports. The script of a `<script module>` file can also write its own signals and optimistic values.
- A module that uses none of these forms adds nothing to the page.
- A throw in a module memo, gate, or debounced or throttled value goes to the nearest `#try` of each component that reads it. The write that caused it does not throw, and the other values of the change still update.
- A module memo can return a promise or an async iterable and can use `await`, as a component memo can.
- An async module memo loads once for every reader. Server requests share one load. A failed load goes only to the requests that read it, and the next request loads again.
- A component reads an imported memo, gate, or debounced or throttled value as a memo of its own, so `#loading`, `await`, `$isPending`, `$resolve`, `#try` and `BRM182` work on it.
- `$resolve` takes the names that a component imports from a module.
- The page state carries the value of a loaded module memo and the values of its sources. On resume, the browser keeps the value while the sources are the same, and loads once when they differ.
- A gate, or a debounced or throttled value, over a module memo that is loading waits for it.
- Module forms keep the error codes of the matching component forms: `BRM085` to `BRM092`, `BRM120`, `BRM161`, `BRM202` and `BRM203`.
- `BRM211` reports a form that a module cannot compile, such as `$effect`, `$client`, `await` in a gate, or a `$optimistic` source that is not a module memo.
- A write through an import is `BRM117`, with advice.
- `brumate check` reports `BRM208` when a plain `.ts` file imports a module signal.
