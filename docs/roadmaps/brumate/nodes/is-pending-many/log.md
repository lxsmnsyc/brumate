# Log

- `$isPending(a) || $isPending(b)` already guarded BRM182 (condition() joins `||`). Kept; tested.
- Chose "any" (the brief's proposal). Analyzer pins each named memo; pending-reads checks every argument; client rewrite joins the checks of all arguments, deduped; server stays `false`.
- BRM108 message reworded (no new code). errors.md in skill regenerated with UPDATE_SKILL=1.
- differential-4 ResolveGoneChild failed once under load, passed alone.
