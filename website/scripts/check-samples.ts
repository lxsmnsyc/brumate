// Compiles every live sample of the docs and of the pages of @brumate/ui, so a sample that stops compiling,
// or that the compiler warns about, fails the check.
import { readFileSync, readdirSync } from 'node:fs';
import { analyzeProject, compile } from 'brumate';
import MarkdownIt from 'markdown-it';

const folders = [new URL('../docs/', import.meta.url), new URL('../ui/', import.meta.url)];
const parser = new MarkdownIt();
let failures = 0;
let samples = 0;

const pages: { folder: URL; file: string }[] = [];
for (const folder of folders) {
  const markdown: string[] = [];
  for (const file of readdirSync(folder)) {
    if (file.endsWith('.md')) {
      markdown.push(file);
    }
  }
  for (const file of markdown.toSorted()) {
    pages.push({ folder, file });
  }
}

for (const { folder, file: page } of pages) {
  // A sample of a page of @brumate/ui is named with its folder.
  const name = folder.pathname.endsWith('/ui/') ? `ui/${page}` : page;
  const tokens = parser.parse(readFileSync(new URL(page, folder), 'utf8'), {});
  const groups: { line: number; files: Map<string, string> }[] = [];
  let previous = -2;
  for (const [index, token] of tokens.entries()) {
    const match =
      token.type === 'fence'
        ? /^(?:brm|html|ts)\s+live\b(?:\s+(\S+))?/.exec(token.info.trim())
        : null;
    if (!match) {
      continue;
    }
    if (previous !== index - 1) {
      groups.push({ line: (token.map?.[0] ?? 0) + 1, files: new Map() });
    }
    const group = groups.at(-1)!;
    group.files.set(match[1] ?? (group.files.size === 0 ? 'App.brm' : 'module.ts'), token.content);
    previous = index;
  }
  for (const { line, files } of groups) {
    samples++;
    const components = new Map<string, string>();
    for (const [file, source] of files) {
      if (file.endsWith('.brm')) {
        components.set(file, source);
      }
    }
    const liveProps = analyzeProject(components);
    for (const [file, source] of components) {
      try {
        const { warnings } = compile(source, {
          filename: file,
          path: `/${file}`,
          liveProps: liveProps.get(file),
          // A module of reactive logic is another file of the sample.
          resolveModule: (specifier) => {
            const module = specifier.replace(/^\.\//, '');
            const text = files.get(module);
            return text === undefined ? undefined : { path: `/${module}`, source: text };
          },
        });
        for (const warning of warnings) {
          failures++;
          console.error(`${name}:${line} ${file}: warning: ${warning.message}`);
        }
      } catch (error) {
        failures++;
        console.error(`${name}:${line} ${file}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
}

console.log(`${samples} samples, ${failures} problems`);
process.exitCode = failures > 0 ? 1 : 0;
