# Log: dock-call-data

- 2026-11-09: worktree .claude/worktrees/node-dock-call-data. Server side: `createRecorder` in devtools-calls.ts, wired in `handleDevRPC` (vite.ts); nested calls through a hook in `dedupe` (request.ts). Browser side: `readCall`, called from the fetch wrapper in devtools.ts.
- Tests in test/devtools-calls.test.ts pass (7). tsc, oxlint (no new warnings in my files) and oxfmt pass.
- The base branch feat/dev-dock-redesign lacks the node's brief and the contract file; the contract is copied from main with the final type.
