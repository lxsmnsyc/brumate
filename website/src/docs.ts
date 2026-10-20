// The pages of the documentation. The site's own pages are in `website/docs`,
// and the rest come from the documents of the repository, so each is written once.

interface Heading {
  level: number;
  text: string;
  id: string;
}

export interface Page {
  title: string;
  html: unknown;
  headings: Heading[];
}

const site = import.meta.glob<Page>('../docs/*.md', { eager: true, import: 'default' });
const repository = import.meta.glob<Page>('../../docs/*.md', { eager: true, import: 'default' });

/** The pages, by their path after `/docs/`. */
export const pages: Record<string, Page> = {};
for (const [file, page] of Object.entries({ ...repository, ...site })) {
  const name = /([\w-]+)\.md$/.exec(file)![1]!;
  pages[name === 'index' ? '' : name] = page;
}

/** The sections of the sidebar, in reading order. */
export const sections: { title: string; pages: { slug: string; title: string }[] }[] = [
  {
    title: 'Guide',
    pages: ['', 'getting-started', 'syntax', 'server-functions', 'routing', 'styles'],
  },
  { title: 'Tools', pages: ['vite', 'typescript', 'inspect'] },
  { title: 'How it works', pages: ['model', 'page-format', 'compiler', 'decisions', 'prior-art'] },
].map((section) => ({
  title: section.title,
  pages: section.pages.map((slug) => ({
    slug,
    title: slug === '' ? 'Introduction' : (pages[slug]?.title ?? slug),
  })),
}));
