# Opponent measurements, round 1

Setup: scratch copy of the branch package (packages/brumate of fix/function-prop-reads) at
$SCRATCH/pkg with node_modules linked; src/graph.ts patched per option. Nothing in the repo or worktree changed.

## Option B patch (no write scan)
```diff
--- /Users/alexis/Documents/GitHub/brumate/.claude/worktrees/function-prop-reads/packages/brumate/src/graph.ts	2026-10-31 11:53:14
+++ graph.B.ts	2026-10-31 12:17:56
@@ -211,7 +211,7 @@
 /** True for a function prop of a component that only reads values and is not named like a handler. */
 function isDerivation(site: Site, writes: (site: Site) => boolean): boolean {
   const owner = site.owner;
-  if (owner?.kind !== 'component' || writes(site)) {
+  if (owner?.kind !== 'component') {
     return false;
   }
   // The parser gives `onClick=…` and the like the kind `event`: those are handlers, which call
```

## Option C patch (write scan counts only tracked writes and tracked calls)
```diff
--- /Users/alexis/Documents/GitHub/brumate/.claude/worktrees/function-prop-reads/packages/brumate/src/graph.ts	2026-10-31 11:53:14
+++ graph.C.ts	2026-10-31 12:18:59
@@ -335,10 +335,12 @@
       return false;
     }
     seen.add(site);
-    if (site.writes.length > 0) {
-      return true;
+    for (const write of site.writes) {
+      if (write.tracked) {
+        return true;
+      }
     }
-    for (const callee of site.calls) {
+    for (const callee of site.trackedCalls) {
       if (callee.site && writes(callee.site, seen)) {
         return true;
       }
```

## 1. Compile diff, branch dist vs option-B dist (dist copy, isDerivation without writes())
Script: opponent-cmp.mjs (compares client, parts, table, server, clientCode).
- packages/ui, examples, website, benchmarks, packages/brumate/test/render: 1137 files, 8 fail to resolve imports on both, 4 differ:
  test/render/handlerRefsProp.brm, handlerRefsPropOnce.brm, handlerRefsTemplateProp.brm (`cb=bump`, bump does `n += 1`),
  orderedCalls.brm (`first=(() => (log += 'a')) second=(() => (log += 'b'))`).
- main dist vs option-B dist on ui, examples, website, benchmarks: 718 files, 6 unresolved (data.brm.ts, counter.brm.ts imports), 1 differs: website/ui/demos/FormSignupDemo.brm (the J7 file).
- So on real code option B emits exactly what #395 emits.

## 2. Size of the fixtures that differ (all parts + table, gzip of the joined text)
| file | #395 | option B |
| handlerRefsPropOnce | 961 raw / 435 gz | 1052 / 461 |
| handlerRefsProp | 1082 / 441 | 1173 / 464 |
| orderedCalls (2 callback props) | 444 / 212 | 681 / 259 |
Option B adds `u2($$s){ $$b.prop($$s, 0, "cb", bump$.bind(null, $$s)) }` and a table entry per callback prop.

## 3. Test runs (vitest, scratch copy)
- Option B: test/resume.test.ts 407/407 pass. Full suite: 4 fails, all path-related to the scratch location
  (check-command reads website/docs/errors.md; vite.test devtools/serial entry), not to graph.ts.
- Loop probe regLoop.brm + RegLoopChild.brm (child `$effect(() => add(value))`, parent `function add(n) { total += n }`, prop `add=add`):
  - option B: one click runs the child effect 51 times (stopped by the probe's own cap of 50), total = 50.
    Without the cap it does not stop: brumate's client runtime has no update-depth guard (grep depth|infinite|loop in src/runtime/client, batch.ts, shared.ts: none).
  - #395 (write scan): passes (< 5 runs).
  - option C: passes (< 5 runs).
- untrackWrite.brm (J4 case, `function nameOf() { $untrack(reads++); return first; }`): option C updates the child to GRACE; resume.test.ts 409/409 pass under C (407 + 2 probes).
