// The pages of the documentation, from the Markdown files in `website/docs`.
// The design notes of the repository stay in `docs` on GitHub.

import type { Page } from '../plugins/markdown.ts';

export type { Page };

const files = import.meta.glob<Page>('../docs/*.md', { eager: true, import: 'default' });

/** The pages, by their path after `/docs/`. */
export const pages: Record<string, Page> = {};
for (const [file, page] of Object.entries(files)) {
  const name = /([\w-]+)\.md$/.exec(file)![1]!;
  pages[name === 'index' ? '' : name] = page;
}

/** Shorter names for the sidebar, where the title of a page is long or close to another one. */
const labels: Record<string, string> = {
  effects: 'Effects',
  'reactive-modules': 'Shared logic',
  forms: 'Forms',
  security: 'Security',
  environment: 'Environment variables',
  packages: 'Publishing',
  'reference-plugin': 'Plugin options',
  'reference-security': 'Security checks',
};

/** The sections of the sidebar, in reading order. */
export const sections: { title: string; pages: { slug: string; title: string }[] }[] = [
  { title: 'Start', pages: ['', 'getting-started', 'tutorial'] },
  { title: 'Components', pages: ['components', 'markup', 'styles'] },
  {
    title: 'Reactivity',
    pages: ['state', 'control-flow', 'effects', 'what-runs-where', 'context', 'reactive-modules'],
  },
  { title: 'Data', pages: ['server-functions', 'async-data', 'forms'] },
  { title: 'Pages', pages: ['routing', 'navigation', 'page-metadata'] },
  { title: 'Production', pages: ['security', 'environment', 'testing', 'deploying', 'packages'] },
  { title: 'Tools', pages: ['typescript', 'editor', 'inspect'] },
  {
    title: 'Reference',
    pages: [
      'reference-signals',
      'reference-blocks',
      'reference-server',
      'reference-routes',
      'reference-plugin',
      'reference-serialization',
      'reference-security',
    ],
  },
  {
    title: 'Internals',
    pages: [
      'reactive-graph',
      'page-format',
      'server-protocol',
      'style-compilation',
      'client-modules',
    ],
  },
].map((section) => ({
  title: section.title,
  pages: section.pages
    .filter((slug) => slug in pages)
    .map((slug) => ({
      slug,
      title: slug === '' ? 'Introduction' : (labels[slug] ?? pages[slug]!.title),
    })),
}));
