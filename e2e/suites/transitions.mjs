// The production build of examples/view-transitions. Elements marked with `viewTransition` and
// `viewTransitionName` get a name only while a transition runs. The test reads the animations of
// the pseudo-elements that the browser makes, by name.
import path from 'node:path';
import { assert, repo, serveBuild, watch, watchPolicy } from '../lib.mjs';

const root = path.join(repo, 'examples/view-transitions');
const TIMEOUT = 5000;

export const build = [['pnpm', ['--filter', 'example-view-transitions', 'build']]];

export function start() {
  return serveBuild(root);
}

/** Wraps `startViewTransition`, to count the transitions and keep the last one with its names. */
function spy() {
  window.starts = 0;
  const original = document.startViewTransition?.bind(document);
  if (!original) {
    return;
  }
  document.startViewTransition = (options) => {
    window.starts++;
    window.named = [...document.querySelectorAll('[b-vt],[b-vtn]')]
      .map((element) => element.style.viewTransitionName)
      .filter(Boolean);
    const started = original(options);
    window.last = started;
    return started;
  };
}

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  watchPolicy(page, errors);
  await page.addInitScript(spy);
  const step = runner.flow('transitions', { page, errors });

  const names = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[b-vt],[b-vtn]')]
        .map((element) => element.style.viewTransitionName)
        .filter((name) => name && name !== 'none'),
    );
  const classes = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[b-vt]')]
        .map((element) => element.style.getPropertyValue('view-transition-class'))
        .filter(Boolean),
    );
  /** The pseudo-elements with an animation, once the transition is ready: `group(item-1)`. */
  const pseudos = () =>
    page.evaluate(async () => {
      await window.last.ready;
      const found = new Set();
      for (const animation of document.getAnimations({ subtree: true })) {
        const pseudo = animation.effect?.pseudoElement;
        if (pseudo?.startsWith('::view-transition-')) {
          found.add(pseudo.slice('::view-transition-'.length));
        }
      }
      return [...found];
    });
  const settle = () =>
    page.evaluate(() => window.last.finished.catch(() => {}), null, { timeout: 10_000 });
  const items = () => page.locator('.item').allTextContents();

  await step('/: the elements carry b-vt and b-vtn, and no name at rest', async () => {
    await page.goto(`${url}/`);
    await page.waitForSelector('.item');
    const marked = await page.evaluate(() => ({
      vt: document.querySelectorAll('[b-vt]').length,
      vtn: document.querySelectorAll('[b-vtn]').length,
      property: document.querySelector('.item').getAttribute('style'),
      hero: document.querySelector('.hero').getAttribute('b-vtn'),
    }));
    assert(marked.vt === 5, `${marked.vt} elements with b-vt`);
    assert(marked.hero === 'hero', 'the hero has no b-vtn');
    assert(marked.property === null, `an item has a style: ${marked.property}`);
    assert((await names()).length === 0, 'an element has a name at rest');
  });

  await step('a list reversed in transition() slides, and the names go after', async () => {
    const before = await items();
    await page.click('.reverse');
    await page.waitForFunction(() => window.starts === 1, null, { timeout: TIMEOUT });
    const named = await page.evaluate(() => window.named);
    assert(
      ['item-', 'hero'].every((name) => named.some((it) => it.startsWith(name))),
      `named: ${named}`,
    );
    assert(!named.some((name) => name.startsWith('far-')), 'an element out of view was named');
    const groups = await pseudos();
    const itemNames = named.filter((name) => name.startsWith('item-'));
    assert(itemNames.length === before.length, `${itemNames.length} items named`);
    for (const name of itemNames) {
      assert(groups.includes(`group(${name})`), `no group for ${name}: ${groups}`);
    }
    assert(!groups.some((group) => group.includes('far-')), 'the far element has a group');
    assert((await items()).join() === before.toReversed().join(), 'the list did not reverse');
    await settle();
    assert((await names()).length === 0, `names after: ${await names()}`);
    assert((await classes()).length === 0, 'classes after');
    const style = await page.evaluate(() => document.querySelector('.item').getAttribute('style'));
    assert(style === null, `the style attribute stays: ${style}`);
  });

  await step(
    'an item that moves keeps its name, a new one fades in, a removed one out',
    async () => {
      const before = await page.evaluate(() => window.starts);
      // The element that moves in a reverse is the same one, so the first item of the page.
      await page.click('.add');
      await page.waitForFunction((count) => window.starts === count + 1, before, {
        timeout: TIMEOUT,
      });
      let found = await pseudos();
      const added = found.filter((name) => /^new\(item-\d+\)$/.test(name));
      const old = found.filter((name) => /^old\(item-\d+\)$/.test(name));
      // The five items are on the page; the new one has no old image.
      assert(added.length === 5 && old.length === 4, `added ${added.length}, old ${old.length}`);
      await settle();
      await page.click('.remove');
      await page.waitForFunction((count) => window.starts === count + 2, before, {
        timeout: TIMEOUT,
      });
      found = await pseudos();
      const gone = found.filter((name) => /^old\(item-\d+\)$/.test(name));
      const stay = found.filter((name) => /^new\(item-\d+\)$/.test(name));
      assert(gone.length === 5 && stay.length === 4, `gone ${gone.length}, new ${stay.length}`);
      await settle();
      assert((await names()).length === 0, 'names after the removal');
    },
  );

  await step('a handler without transition() starts no transition', async () => {
    const before = await page.evaluate(() => window.starts);
    const list = await items();
    await page.click('.plain');
    await page.waitForFunction(
      (text) => document.querySelector('.item').textContent !== text,
      list[0],
    );
    assert((await page.evaluate(() => window.starts)) === before, 'a transition started');
    assert((await names()).length === 0, 'an element has a name');
  });

  await step('prefers-reduced-motion keeps a handler from starting a transition', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const before = await page.evaluate(() => window.starts);
    const list = await items();
    await page.click('.reverse');
    await page.waitForFunction(
      (text) => document.querySelector('.item').textContent !== text,
      list[0],
    );
    assert((await page.evaluate(() => window.starts)) === before, 'a transition started');
    assert((await names()).length === 0, 'an element has a name');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  await step('a navigation pairs the elements of one name, not those out of view', async () => {
    await page.click('.to-detail');
    await page.waitForFunction(() => window.starts >= 1 && location.pathname === '/detail', null, {
      timeout: TIMEOUT,
    });
    const named = await page.evaluate(() => window.named);
    assert(named.includes('hero'), `named: ${named}`);
    assert(!named.some((name) => name.startsWith('far-')), 'the far element was named');
    const found = await pseudos();
    assert(found.includes('group(hero)'), `no group for the hero: ${found}`);
    assert(found.includes('old(hero)') && found.includes('new(hero)'), `not paired: ${found}`);
    await settle();
    assert((await names()).length === 0, 'the hero keeps its name');
    assert((await page.evaluate(() => location.pathname)) === '/detail', 'not on /detail');
  });
  await page.close();

  // A browser without view transitions.
  const bare = await browser.newPage();
  const bareErrors = watch(bare);
  await bare.addInitScript(() => {
    delete Document.prototype.startViewTransition;
  });
  await runner.step(
    'transitions',
    'without startViewTransition, the handler and the navigation run as before',
    { page: bare, errors: bareErrors },
    async () => {
      await bare.goto(`${url}/`);
      await bare.waitForSelector('.item');
      assert(
        (await bare.evaluate(() => typeof document.startViewTransition)) === 'undefined',
        'the browser has startViewTransition',
      );
      const list = await bare.locator('.item').allTextContents();
      await bare.click('.reverse');
      await bare.waitForFunction(
        (text) => document.querySelector('.item').textContent !== text,
        list[0],
        { timeout: TIMEOUT },
      );
      await bare.click('.to-detail');
      await bare.waitForFunction(() => location.pathname === '/detail', null, {
        timeout: TIMEOUT,
      });
      await bare.waitForSelector('.big');
    },
  );
  await bare.close();
}
