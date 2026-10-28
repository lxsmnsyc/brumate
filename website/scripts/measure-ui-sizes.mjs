// Measures the JavaScript that a page loads for a part of @brumate/ui, gzipped: the loader, the
// core and the bundles of the components that the page renders. The page renders the part once,
// closed or not pressed, and nobody uses it. Run it from the website folder:
//
//   node scripts/measure-ui-sizes.mjs [scenario ...]
//
// It builds each scenario as a small app in `.ui-sizes`, renders it on the server, and adds up
// the files that the build lists for the components found in the HTML.
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const scenarios = {
  none: '<p>Nothing</p>',
  checkbox: `<script>import Checkbox from '@brumate/ui/Checkbox.brm';</script>
<Checkbox>Accept</Checkbox>`,
  button: `<script>import Button from '@brumate/ui/Button.brm';</script>
<Button>Save</Button>`,
  tabs: `<script>
  import Tab from '@brumate/ui/Tab.brm';
  import TabList from '@brumate/ui/TabList.brm';
  import TabPanel from '@brumate/ui/TabPanel.brm';
  import Tabs from '@brumate/ui/Tabs.brm';
</script>
<Tabs>
  <TabList aria-label="Letters"><Tab id="a">A</Tab><Tab id="b">B</Tab></TabList>
  <TabPanel id="a">One</TabPanel>
  <TabPanel id="b">Two</TabPanel>
</Tabs>`,
  dialog: `<script>
  import Button from '@brumate/ui/Button.brm';
  import Dialog from '@brumate/ui/Dialog.brm';
  import DialogTrigger from '@brumate/ui/DialogTrigger.brm';
  import Heading from '@brumate/ui/Heading.brm';
  import Popover from '@brumate/ui/Popover.brm';
</script>
<DialogTrigger>
  <Button>About</Button>
  <Popover>
    <Dialog>
      <Heading slot="title" level=(4)>About</Heading>
      <p>Hello</p>
      <Button slot="close">Close</Button>
    </Dialog>
  </Popover>
</DialogTrigger>`,
  select: `<script>
  import Button from '@brumate/ui/Button.brm';
  import ListBox from '@brumate/ui/ListBox.brm';
  import ListBoxItem from '@brumate/ui/ListBoxItem.brm';
  import Popover from '@brumate/ui/Popover.brm';
  import Select from '@brumate/ui/Select.brm';
  import SelectValue from '@brumate/ui/SelectValue.brm';
</script>
<Select aria-label="Letter">
  <Button><SelectValue /></Button>
  <Popover>
    <ListBox><ListBoxItem id="a">A</ListBoxItem><ListBoxItem id="b">B</ListBoxItem></ListBox>
  </Popover>
</Select>`,
};

const directory = '.ui-sizes';
const only = process.argv.slice(2);
const run = (command) => execSync(command, { cwd: directory, stdio: 'pipe' });

rmSync(directory, { recursive: true, force: true });
mkdirSync(`${directory}/src`, { recursive: true });
writeFileSync(
  `${directory}/vite.config.ts`,
  `import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [brumate({ navigate: false })],
  build: { manifest: true, rolldownOptions: { input: 'src/client.ts' } },
});
`,
);
writeFileSync(`${directory}/src/client.ts`, "import 'virtual:brumate/start';\n");
writeFileSync(
  `${directory}/src/server.ts`,
  `import { renderToStream } from 'brumate/server';
import App from './App.brm';

export async function page(): Promise<string> {
  const stream = renderToStream(App, {}, { start: '<!doctype html><body>', end: '</body>', scripts: '' });
  const reader = stream.getReader();
  let html = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return html;
    }
    html += value;
  }
}
`,
);

try {
  let base = 0;
  for (const [name, source] of Object.entries(scenarios)) {
    if (only.length > 0 && !only.includes(name)) {
      continue;
    }
    writeFileSync(`${directory}/src/App.brm`, source);
    rmSync(`${directory}/dist`, { recursive: true, force: true });
    run('npx vite build --outDir dist/client');
    run('npx vite build --ssr src/server.ts --outDir dist/server');
    const { page } = await import(`../${directory}/dist/server/server.js?${name}`);
    const html = await page();
    const hints = JSON.parse(readFileSync(`${directory}/dist/client/.brumate/hints.json`, 'utf8'));
    // The server preloads the bundle of the page's component, `App`, and of each component that
    // the HTML names, such as `Button_1qpvhkd#h61`. A component whose code is in the bundle of
    // `App` has no name of its own in the HTML.
    const roots = new Set(Object.keys(hints.bundles).filter((root) => root.startsWith('App_')));
    for (const root of Object.keys(hints.bundles)) {
      if (html.includes(`${root}#`)) {
        roots.add(root);
      }
    }
    const urls = new Set(hints.all);
    for (const root of roots) {
      for (const url of hints.bundles[root] ?? []) {
        urls.add(url);
      }
    }
    let gzip = 0;
    for (const url of urls) {
      gzip += gzipSync(readFileSync(`${directory}/dist/client${url}`)).length;
    }
    if (name === 'none') {
      base = gzip;
    }
    const added = ((gzip - base) / 1024).toFixed(2);
    console.log(
      `${name.padEnd(9)} ${(gzip / 1024).toFixed(1).padStart(5)} kB gzip, ${added.padStart(6)} kB more than none`,
    );
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
