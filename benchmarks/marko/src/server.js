import page from './page.marko';

export function todos(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    title: `Todo number ${i + 1}`,
    done: i % 3 === 0,
  }));
}

export async function render(n) {
  let html = '';
  for await (const chunk of page.render({ initial: todos(n) })) html += chunk;
  return html;
}
