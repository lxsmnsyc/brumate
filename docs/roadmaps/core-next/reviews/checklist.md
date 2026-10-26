# Checklist

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
