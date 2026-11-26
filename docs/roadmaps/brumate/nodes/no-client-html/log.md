# Log: no-client-html

## Base

- Commit 750f653 (batch/brumate-release-0.10 plus the current brief from main).
- Pages of `test/render` with `clientHTML` on: 61 of 681 (counted with `getFeatures` over each compiled page).
- Todos gzip JS before `load`: pending: bench lock (state-dedupe-spike holds it). The orchestrator will say when to run it, on the base and on the branch.

## Notes

- After the `rawNodes` change, 5 pages still gave `return $$html;`: awaitLoadingOn, blocks, refForward, textarea, twoTitles. blocks and refForward failed on `reader.raw` staying true after `</template>`. textarea and twoTitles had mixed text and values in `<textarea>` and `<title>`. Both fixed in codegen/template.ts; after that 1 of 681 pages (awaitLoadingOn) turns `clientHTML` on.
- Rerun results: resume 671 pass, differential-1..4 pass, ui vitest 846 pass, e2e ui 61 and browser-async 6 pass. Bench not run (lock).
- awaitLoadingOn: its `#loading` body waits (`$$b.wait`), and the HTML of the body and of the callback share one `$$html`, which `cloneLines` cannot split. Other HTML-string bodies are the fallback of `cloneLines` for exotic markup.
- Plan: `rawNodes` returns a `RawNodes` (fragment and scope); a node form `insertOut` gives children, templates and arrays as a fragment; the node paths (`setContent`, `putText`, `keepText`, `write`) use it. `holdPlace` stays only for `$$b.insert`, `$$b.component`, `$$b.dynamic` and `$$b.nodes` inside an HTML-string body.
