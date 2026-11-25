# Log: default-scripts

- Read the manifest lazily when `virtual:brumate/routes` loads in a build, not in `buildStart`. Nitro's client environment runs `buildStart` before its output exists.
- Client build now sets `build.manifest` when the project leaves it unset, so the entry can be read.
- Full brumate run on a loaded machine (load ~10) timed out in resume, differential and a few others. Each passes alone.
