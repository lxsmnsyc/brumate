# Log: key-letter-case

- Base af581bbf. Added to `test/resume.test.ts` ("prevents only the keys that :prevent names") a press of `k` with metaKey against `prevent(..., 'Mod+K')` (fixture `test/render/preventKeys.brm`).
- Command: `cd packages/brumate && npx vitest run test/resume.test.ts -t "prevents only the keys"`. Result on base code: fails, `expected false to be true` at the `press('k', { metaKey: true })` line. Reproduced.
- Rule for a letter without a modifier: exact case. `a` and `A` type different text, and the docs say a key matches its `event.key`; only the modifier forms fold case. `release/0.8` has no `packages/ui/src/shortcut.ts` on origin, so the rule comes from the brief: either case, Shift not counted.
- Full vitest first run: 4 failures in vite.test.ts, because dist was not built. After `pnpm build` the file passes (33/33).
- `pnpm format:check` flags `nodes/editor-sizes/brief.md`, not a file of this node.
