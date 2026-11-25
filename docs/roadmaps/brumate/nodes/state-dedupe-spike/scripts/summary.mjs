// Prints one line per pair and file of the navigation benchmark's JSON: response gzip, swap
// median and p90, wait and read medians, and the load average median of the runs.
//
//   node summary.mjs FILE.json...
import { readFileSync } from 'node:fs';
import path from 'node:path';

for (const file of process.argv.slice(2)) {
  const { results } = JSON.parse(readFileSync(file, 'utf8'));
  for (const item of results) {
    const { swap, wait, read } = item.time;
    console.log(
      [
        path.basename(file, '.json').padEnd(18),
        item.name.padEnd(12),
        `gzip ${item.response.gzip}`,
        `swap ${swap.median} / p90 ${swap.p90}`,
        `wait ${wait.median}`,
        `read ${read.median}`,
        `load ${item.load.median}`,
      ].join('  '),
    );
  }
}
