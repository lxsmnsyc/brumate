# What detaching a body skips, on main (opponent, round 1)

- branches.ts:326-358 hide(): hides the body's #portal ranges elsewhere in the page (comments `P<scope>`), and runs the cleanups of effects and $client callbacks, which wait (scope.w) until show.
- updates.ts:971-974 effect(): `if (hiding?.paused(scope, name)) return;` is the only pause of an effect in a hidden body.
- handlers.ts:196-199: window/document listeners (b-listen) skip only when `hiding?.hidden(scope)`.
- decisions.md:96-98: #offscreen rule: updates apply while hidden; effects pause; window/document listeners stop; portals hide with the body.
- blocks.ts:230-235 blockStart, inserts.ts:45-62 text(), blocks.ts:181-227 findComment/findElement: a kept node that is not isConnected falls back to the index, then (findElement) document.querySelector(`[b-b="..."]`); a detached marker is never found, so updates to a detached body do nothing until give() reruns them.
- blocks.ts:97-111 sweepIndexes deletes index entries of disconnected nodes.
- So during a detach hold an #if/#for in the body that a settled memo would open does not render; its loads start only in give() after the fallback is gone.
- navigate.ts:117-147 plan(): a navigation keeps a layout with the same key and replaces every other route with the server's markup; route params never reach a kept #loading as a client write.
- updates.ts:262-295: $debounced/$throttled memos call startLoading while they wait, so loadingSlots holds them with no load in flight.
- codegen/markup.ts:2179-2185: a #loading whose body cannot wait renders in place with no boundary and no markers; markers `<!--l<boundary>-->` exist only in the streaming branch (2201), with no scope id or anchor.
