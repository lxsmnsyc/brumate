import page from './page.marko';

export async function render() {
  let html = '';
  for await (const chunk of page.render({})) html += chunk;
  return html;
}
