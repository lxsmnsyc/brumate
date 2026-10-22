// @vitest-environment node
import { beforeEach, expect, it } from 'vitest';
import { handle } from 'virtual:brumate/routes';
import { resetStore } from '../src/store.ts';

// The routes answer requests as the server does, with no browser and no scripts.
const origin = 'http://localhost';

beforeEach(() => {
  resetStore();
});

async function get(path: string, cookie = '') {
  const response = await handle(new Request(`${origin}${path}`, { headers: { cookie } }));
  return { response: response!, html: await response!.text() };
}

/** Posts the form whose `action` starts with `?__action=`, as a browser without scripts does. */
async function post(path: string, html: string, fields: Record<string, string>, cookie = '') {
  const actions = [...html.matchAll(/<form[^>]* action="(\?__action=[^"]+)"/g)].map((match) =>
    match[1]!.replaceAll('&amp;', '&'),
  );
  const body = new URLSearchParams(fields);
  return handle(
    new Request(`${origin}${path}${actions[actions.length - 1]}`, {
      method: 'POST',
      body,
      headers: { origin, cookie, 'content-type': 'application/x-www-form-urlencoded' },
    }),
  );
}

/** The markup of the list of issues, without the page state that follows it. */
const list = (html: string) => /class="issues">(.*?)<\/ul>/s.exec(html)![1]!;

const cookieOf = (response: Response) => response.headers.getSetCookie()[0]!.split(';')[0]!;

it('renders the open issues, and streams the activity after them', async () => {
  const { response, html } = await get('/');
  expect(response.status).toBe(200);
  expect(html).toMatch(/<title[^>]* b-t>Issues<\/title>/);
  expect(list(html)).toContain('Add a dark theme');
  expect(list(html)).not.toContain('Links break on phones');
  expect(html).toContain('Loading the activity…');
  // The activity arrives later in the same response.
  expect(html).toContain('Edsger closed #4');
});

it('starts the list with the search of the URL', async () => {
  const { html } = await get('/?q=phones&status=closed');
  expect(list(html)).toContain('Links break on phones');
  expect(list(html)).not.toContain('Add a dark theme');
});

it('renders an issue, and the #catch of a related issue that is gone', async () => {
  const { html } = await get('/issues/3');
  expect(html).toContain('Document the keyboard shortcuts');
  expect(html).toMatch(/#<!--t[\d.:]+-->2<!--\/t--> <!--t[\d.:]+-->Add a dark theme/);
  expect(html).toContain('was deleted</li>');
});

it('answers 404 for a missing issue and for a path with no route', async () => {
  const missing = await get('/issues/99');
  expect(missing.response.status).toBe(404);
  expect(missing.html).toContain('There is no issue #99');
  expect((await get('/no/such/page')).response.status).toBe(404);
});

it('answers the endpoint with JSON', async () => {
  const { response, html } = await get('/api/issues.json?open=false');
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(JSON.parse(html).map((issue: { title: string }) => issue.title)).toEqual([
    'Links break on phones',
  ]);
});

it('sends a visitor who is not signed in from /issues/new to the sign-in page', async () => {
  const { response } = await get('/issues/new');
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe(`${origin}/sign-in?next=%2Fissues%2Fnew`);
});

it('signs in, shows field errors, and opens an issue, without scripts', async () => {
  const signIn = await get('/sign-in?next=%2Fissues%2Fnew');
  const short = await post('/sign-in', signIn.html, { name: 'A', next: '/issues/new' });
  expect(await short!.text()).toContain('Use 2 to 30 letters');

  const signed = await post('/sign-in', signIn.html, { name: 'Ada', next: '/issues/new' });
  expect(signed!.status).toBe(303);
  expect(signed!.headers.get('location')).toBe(`${origin}/issues/new`);
  const cookie = cookieOf(signed!);

  const form = await get('/issues/new', cookie);
  expect(form.response.status).toBe(200);
  const invalid = await post('/issues/new', form.html, { title: 'No' }, cookie);
  const page = await invalid!.text();
  expect(page).toContain('Write a title of at least 3 characters');
  // The page renders again with what was typed.
  expect(page).toContain('value="No"');

  const created = await post(
    '/issues/new',
    form.html,
    { title: 'Export as CSV', 'labels[]': 'feature' },
    cookie,
  );
  expect(created!.status).toBe(303);
  expect(created!.headers.get('location')).toBe(`${origin}/issues/5`);
  const issue = await get('/issues/5', cookie);
  expect(issue.html).toContain('Export as CSV');
  expect(issue.html).toContain('You<!--/t--> opened it');
});
