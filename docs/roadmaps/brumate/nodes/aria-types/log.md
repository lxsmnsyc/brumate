# Log: aria-types

- Worktree had no node_modules: ran pnpm install and build before tsc.
- Runtime check: aria booleans render as the words true/false (runtime/html.ts TRUE_FALSE), so `AriaBool` accepts both.
- Added AriaAttributes, AriaRole to elements.d.ts; kept the `aria-${string}` fallback.
- Typecheck flagged 5 callers (3 ui parts, ui Toggle fixture, tsc fixture Elements.brm); fixed minimally.
- Contract file on the worktree is behind main: wrote contracts/element-types.change-request.md (v1.4) instead of editing.
- Flakes under load: devtools.test.ts and 3 ui tests failed in the full run, pass alone.
- PR #442 (draft) against next.
