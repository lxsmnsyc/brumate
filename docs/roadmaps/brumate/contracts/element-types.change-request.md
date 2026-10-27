# Change request: element-types v1 to v1.1

- From node: the type audit of 2026-10-27 (reviews/type-parity.md)
- Status: accepted

## Problem

`Elements` rejects values that the runtime and the syntax accept: `class` arrays and objects, `style` objects, `value` on `select`, `value=$bind` and `checked=$bind`, a server function in `form action`, and static strings for number attributes such as `tabindex="0"`. Once element-checks checks plain elements, each becomes a false error.

## Proposed change

Widen those types, as reviews/type-parity.md section 4 B lists, export the handler type, and add `KeyPress` in place of `ToggleEnd`.

## Affected nodes

element-values (writes it), element-checks, mathml-elements, aria-types, missing-attributes, control-target.

## Workaround in place

None. Nothing checks plain elements yet.

## Decision

Accepted by the maintainer on 2026-10-27. The node element-values makes the change and bumps the contract to v1.1.
