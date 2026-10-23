import { build } from '../../../harness/rows.mjs';
import page from './page.marko';

export async function render(n) {
  let html = '';
  for await (const chunk of page.render({ initial: build(1, n) })) html += chunk;
  return html;
}
