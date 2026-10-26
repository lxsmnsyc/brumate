# Log: component-tag-handlers

- Test first: `componentTagHandlers.brm` (a block that opens AsButton with `as=ScopeWrap`) fails on main: `b-on` is only `click=ScopeWrap_1pqzfbq#h1`.
- Fix in client.ts: `spread` takes an incoming `b-on` into `on` first, and writes no attribute for it. `dynamic` and `dynamicNodes` pass a component the props from `tagProps`, whose `b-on` entries name the scope of the tag, as the server does.
- Size after the first version was +0.21 kB, over the 0.05 kB budget. Trimmed to +0.146 kB (see outcome). Further cuts needed a change outside spread/dynamic.
