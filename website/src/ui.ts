// The pages of the section of @brumate/ui, from the Markdown files in `website/ui`, and the
// demos that they show, from `website/ui/demos`.

import type { Component } from 'brumate/server';
import type { Page } from '../plugins/markdown.ts';
import { groups } from './ui-groups.ts';

const files = import.meta.glob<Page>('../ui/*.md', { eager: true, import: 'default' });

/** The pages, by their path after `/ui/`. */
export const pages: Record<string, Page> = Object.create(null);
for (const [file, page] of Object.entries(files)) {
  const name = /([\w-]+)\.md$/.exec(file)![1]!;
  pages[name === 'index' ? '' : name] = page;
}

/** The demos, by their name, such as `PressDemo` for `demos/PressDemo.brm`. */
export const demos: Record<string, Component> = Object.create(null);
for (const [file, demo] of Object.entries(
  import.meta.glob<Component>('../ui/demos/*.brm', { eager: true, import: 'default' }),
)) {
  demos[/(\w+)\.brm$/.exec(file)![1]!] = demo;
}

/** The sections of the sidebar, in reading order. Each part has a page of its own. */
export const sections: {
  title: string;
  pages: { slug: string; title: string; summary: string }[];
}[] = [];
for (const group of groups) {
  const entries: { slug: string; title: string; summary: string }[] = [];
  for (const slug of group.pages) {
    if (slug in pages) {
      entries.push({
        slug,
        title: pages[slug]!.title,
        summary: pages[slug]!.summary,
      });
    }
  }
  sections.push({ title: group.title, pages: entries });
}
