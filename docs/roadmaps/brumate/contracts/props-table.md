---
name: props-table
version: 1
status: draft
defined_by: docs-generator
---

# Contract: props-table

## Purpose

The format of the generated and written tables on a page of website/ui, so the four docs nodes write the same sections.

## Interface

To be frozen by docs-generator. It must define:

- The line a page writes to show the props table of a part, such as `<PropsTable part="Button" />` or a markdown directive.
- The sections of a page, in order: Anatomy, Props, Data attributes, Keyboard, Controlled and uncontrolled, Styling.
- The format of the anatomy tree, the data attribute table and the keyboard table.

## Behavior

- A prop's description is its doc comment. Its default comes from the destructuring of `$props`.

## Stub

Until it is frozen, the docs nodes do not start.

## Contract tests

website/test/props-table.test.ts.

## Changes

- v1: draft.
