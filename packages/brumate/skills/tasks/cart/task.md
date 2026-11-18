# Derived store

Write `src/cart.ts` and `src/Cart.brm`.

- `cart.ts` exports `cart`, a store of an array of prices that starts as `[12, 8]`, and `total`, a read-only store with the sum of the prices, made with `derived` from `brumate/store`.
- `Cart.brm` reads `total` with `$store`. A `p` with the class `total` shows `Total N`. A `button` with the class `add` adds a price of 5 to `cart`.
