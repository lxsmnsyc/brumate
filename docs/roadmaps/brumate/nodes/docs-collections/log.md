# Log: docs-collections

- Made the worktree, read the contract and the docs-controls outcome. Did list-box.md first and built the website to see the generated table: defaults and descriptions come through.
- Wrote doc comments for the props of 36 parts in packages/ui/src (176 comments, comments only), with a script that adds a comment above each prop that has none. TreeRow has none: callers never write it.
- Each page got Anatomy, Props, Data attributes, Keyboard, Controlled and uncontrolled and Styling inserted before its old sections. The old prose `## Keyboard` became `## Focus and keys`, and the Tabs `## Tabs` became `## The tab`, so no heading repeats.
- Data attributes were read from the parts' markup, not from the old prose.
- Template parameters: added the sentence on Tree, NavigationTree, Select, Virtualizer, Data, and new "from data" samples on ListBox, GridList and Table with typed parameters.
- Updated the stale doc comment of Virtualizer (it said only a Tree takes `rowHeight`).
- Checks passed. The ui suite ran with --maxWorkers=2.
