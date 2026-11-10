# Log: dock-layout-fixes

- Collision: style.ts `.seg` (old timeline) hit inspect's toggle. Renamed the toggle to `.views`, dropped dead old-panel rules from style.ts.
- Audit by script: listed the class names per module CSS and the style.ts classes no module draws. Found `.edge` of graph paths matching the dock edge rules; renamed to `.gedge`.
- Inspect: grouped sibling scopes by `k` into block rows; header reset to the prototype.
- Activity: no split until a call is selected.
- Page: rebuilt the layout from the prototype's CSS; values table fixed layout with ellipsis.
- No browser: all layout reasoning from CSS.
