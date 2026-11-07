before: hasContext 291 in packages/ui/src; ui example client gzip 203030 raw 677604
Brief file was only on main (not on the story branch); copied it into the worktree.
Probed ColorSwatchPicker (`const picker = $store(given?.state)`), color tests passed, then rewrote all 63 readers with a perl script that checks the root was declared as `$hasContext(C) ? $getContext(C) : undefined`.
ui tests: 4 failures from unbuilt tsc packages only; passed after building all packages.
after: hasContext 228; ui example client gzip 202998 raw 677527.
