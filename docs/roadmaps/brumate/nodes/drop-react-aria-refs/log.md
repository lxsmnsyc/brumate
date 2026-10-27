# Log: drop-react-aria-refs

- Before: 358 lines named React Aria, in 207 files (packages/ui/src 128 .brm and .ts files, packages/ui/test 50, website/ui 17, packages/ui/README.md, docs/proposals.md). About 120 more lines named its hooks and components without the library, and 24 lines named React Stately, its sibling. Hook names that remain only as code were none.
- Method: two scripted passes for the patterns "as X of React Aria Components", "as in React Aria" and "as React Aria does", then 60 edits by hand for the wrapped and the prose cases. Each edit keeps the sentence and drops the source. Test names lost "as React Aria does".
- Test headers "follow the tests of X in React Aria" became "The tests of X."
- influences.md: the React Aria section is now "How the parts behave", and names the WAI-ARIA patterns. The page names Terracotta and Headless UI as projects.
- docs/proposals.md: the design stays. The source of behavior is the WAI-ARIA patterns. The Apache-2.0 notice sentence is gone, since the code is not ported. Ran oxfmt on it, which reflowed the mapping table.
- React Stately was reworded the same way, because it is the state half of the same library.
- docs/roadmaps/brumate/reviews/wave-8.md fails `oxfmt --check` on main. It is not part of this node.
