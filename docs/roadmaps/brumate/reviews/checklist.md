# Checklist

## ui-0.1

- Data and migrations: N/A. No stored data. The page state of the parts changes only through their props.
- Compatibility: as-controls and as-collections replace `[attribute: string]: unknown` with the attributes of the target on more parts. Callers that pass other attributes break. Accepted: the framework is unstable. Each node fixes the callers in the repo, checked by `pnpm typecheck`.
- Auth and permissions: N/A. No server code.
- Failure modes: a component in `as` that does not forward `ref` leaves the part without its element. The as-* nodes test a component that forwards, and the docs say a target must forward.
- Concurrency: N/A, beyond merge order of shared files (website/src/ui.ts, props-types.ts).
- Limits: popover-sizing covers long lists in a short viewport.
- Security: N/A.
- Observability: N/A.
- Performance: a part that is closed or unused must still ship close to nothing. The as-* nodes keep the e2e checks of what ships.
- Testing: every node has a verify command. Docs nodes run check:samples. e2e runs after merges, at checkpoints.
- Developer experience: the docs nodes are the point of this roadmap. The props tables come from the types, so they cannot drift.
- Rollout: N/A. Unpublished package.
- Cleanup: none expected.
- Coverage: see GOAL.md.
- Dependencies: none new.

## Core

- Data and migrations: the page state format may change in ordered-updates (the `g` tables). Old pages in a cache resume with old code, since each build has its own bundles. N/A beyond that.
- Compatibility: batching changes when bindings write the DOM. A handler that writes and reads the DOM before it returns needs `flush()`. batching audits the parts of @brumate/ui.
- Auth and permissions: N/A.
- Failure modes: an update that throws stops the pass. ordered-updates must keep the error going to the nearest `#try`, as now.
- Concurrency: async memos, streamed values and `$optimistic` start passes of their own. ordered-updates and batching test them.
- Limits: the size of the `g` tables with the memo lists. ordered-updates measures it.
- Security: N/A.
- Observability: the devtools read the update tables. ordered-updates keeps the devtools tests passing.
- Performance: every node reports the gzip size of the core for todos. Budget in GOAL.md.
- Testing: the `it.fails` tests of #155 are the acceptance of ordered-updates.
- Developer experience: `flush()` needs docs, in batching.
- Rollout: N/A.
- Cleanup: split-client-runtime leaves client.ts as a file that re-exports the modules.
- Coverage: see GOAL.md.
- Dependencies: none new.
