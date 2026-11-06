# Log: memo-object-cast

- Reproduced on main: `$memo({ a: n, b: 2 } as Record<string, unknown>)` emits `$$b.memo($$s, 1, () => { a: ... } as Record<...>)` and the parse fails.
- Cause: `packages/brumate/src/codegen/client.ts` wrapped the arrow body only when the memo argument was an `ObjectExpression`. A `TSAsExpression`, `TSSatisfiesExpression` or `TSNonNullExpression` around the object, or a sequence that starts with one, was not wrapped.
- First try checked the emitted code for a leading `{`. It failed because the rewriter puts template markers before the code. The fix checks the source character at the start of the expression.
- Other places that build `() => <user code>` were checked. The server wraps with `((`, the early load (`$$b.started`, `$$b.after`) takes code that the patch already wrapped in parentheses, and `$resolve` builds its own checks. Only the client memo and timed memo needed the fix.
