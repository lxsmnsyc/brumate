# Log

- 2026-11-01: Reproduced on main. A child inside a `#try` whose module load rejects after the parent wrote its prop: no `#catch`, the page stays as it was.
- First fixture had a `#try` without a reset button and its compiled module had no `t` table, so `fail` found no `#try` at all. The fixture copies the shape of handlerWaitFail (inner button, `reset`) instead.
- The load of the child starts at resume, so the test holds it with a gate until after the click, then rejects it.
