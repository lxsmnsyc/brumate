import { escapeAttribute } from './html.ts';
import { ServerError, isRedirect } from './request.ts';
import type { RequestEvent } from './request.ts';
import type { RouteMatch } from './router.ts';
import type { ScopeId } from './shared.ts';
import {
  type Component,
  type Context,
  type PageCache,
  type ResolvedView,
  type RenderResult,
  type RouteOptions,
  NOTHING_PENDING,
  clientBundles,
  component,
  deferTarget,
  errorAnswer,
  keepPage,
  keptPage,
  lazy,
  logError,
  pageKey,
  render,
  renderError,
  resolveView,
  respond,
  runAction,
  streamParts,
  // oxlint-disable-next-line import/no-cycle -- Route rendering and the render core call each other, and every call runs after both modules load.
} from './server.ts';

/** The `cache` of the page of a view: the nearest one along its `children`. */
function pageCache(view: ResolvedView): PageCache | undefined {
  const inner = view.slots.children;
  return (inner && pageCache(inner)) ?? view.cache;
}

/**
 * The `cache-control` of a page with `cache`. It is public only when the
 * request did not read or set anything of the user, and the page is a
 * success without cookies.
 */
function cacheControl(
  cache: PageCache,
  event: RequestEvent | undefined,
  response: Response,
): string {
  if (event?.personal || response.status !== 200 || response.headers.getSetCookie().length > 0) {
    return 'private, no-cache';
  }
  const parts = ['public', `max-age=${Math.max(0, Math.floor(cache.maxAge))}`];
  if (cache.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${Math.max(0, Math.floor(cache.staleWhileRevalidate))}`);
  }
  return parts.join(', ');
}

// Pages that `cache` made private in development, so each warns once.
const warnedPrivate: Set<string> = new Set<string>();

/**
 * Renders a view where its layout inserts it. A view with a loading file
 * streams in after the rest of the page, as a `#loading` body does.
 */
async function renderView(
  view: ResolvedView,
  props: Record<string, unknown>,
  ctx: Context,
  scope: ScopeId | undefined,
): Promise<string> {
  if (!view.loading) {
    return component(viewComponent(view, props), {}, ctx, scope);
  }
  const id = ctx.boundary();
  const fallback = await component(view.loading, props, ctx, scope);
  ctx.defer(id, (child) => component(viewComponent(view, props), {}, child, scope));
  return `<!--l${id}-->${fallback}<!--/l-->`;
}

/**
 * A component that renders a route, with its slots rendering where the
 * layout inserts them. `props` go to every view, such as `params`.
 */
/** The component IDs of a view and of the views in its slots. */
function viewIds(view: ResolvedView): string[] {
  const id = (view.component as { brumateId?: string }).brumateId;
  const ids: string[] = id === undefined ? [] : [id];
  for (const slot of Object.values(view.slots)) {
    ids.push(...viewIds(slot));
  }
  return ids;
}

function viewComponent(view: ResolvedView, props: Record<string, unknown>): Component {
  return (_props, ctx) => {
    const own: Record<string, unknown> = { ...props };
    for (const [name, slot] of Object.entries(view.slots)) {
      // Comments mark the slot, its layout's scope, the scope of its route and the route's key,
      // so the client can replace only the routes that change.
      own[name] = lazy(async (at, scope) => {
        const root = at.peek();
        const html = await renderView(slot, props, at, scope);
        return `<!--R${scope ?? -1}:${name}:${root}:${encodeURIComponent(slot.key)}-->${html}<!--/R-->`;
      });
    }
    return view.component(own, ctx);
  };
}

/** Renders the page of a route tree, streamed, with the results of a form for `$action`. */
export async function renderPage(
  view: ResolvedView,
  props: Record<string, unknown>,
  request: Request,
  options: RouteOptions,
  extra: { actions?: Map<unknown, unknown>; status?: number },
): Promise<Response> {
  // A page that the client loads in place of another starts above its IDs.
  const base = Number(request.headers.get('x-brumate-base'));
  const defer = deferTarget(request);
  if (defer) {
    return renderDeferred(view, props, request, options, defer, base);
  }
  // In development, the render records what it does and when, for the Server tab of the devtools.
  const event = options.event;
  if (options.dev && event) {
    event.trace = [];
    event.traceStart = performance.now();
  }
  const path = new URL(request.url).pathname;
  const endRender = event?.traced('render', path) ?? (() => {});
  // Client navigation has the loader and the core already. The stylesheets of the bundles of the
  // views go in the head of every page, so a navigation keeps those of the next page.
  const navigation = request.headers.has('x-brumate-base');
  const wanted: string[] = navigation ? [] : [...(options.hints ?? [])];
  const styles = new Set<string>();
  for (const id of viewIds(view)) {
    for (const url of options.bundleHints?.[id] ?? []) {
      // A relative URL is relative to the page, which is wrong on a page deeper than the base,
      // so the state records name those stylesheets for the loader instead.
      if (url.endsWith('.css')) {
        if (!url.startsWith('.')) {
          styles.add(url);
        }
      } else if (!navigation) {
        wanted.push(url);
      }
    }
  }
  const hints = [...new Set(wanted)];
  // A page with a nonce, under a strict policy, loads only what carries the nonce. A `Link`
  // header cannot, so the links are in the head only.
  const nonce = options.nonce === undefined ? '' : ` nonce="${escapeAttribute(options.nonce)}"`;
  const links: string[] = [];
  if (!nonce) {
    for (const url of hints) {
      links.push(`<${url}>; rel=modulepreload`);
    }
  }
  if (links.length > 0) {
    options.earlyHints?.(links);
  }
  let preload = '';
  for (const url of hints) {
    preload += `<link rel="modulepreload"${nonce} href="${escapeAttribute(url)}">`;
  }
  for (const url of styles) {
    preload += `<link rel="stylesheet"${nonce} href="${escapeAttribute(url)}">`;
  }
  let parts: RenderResult;
  try {
    parts = await render(
      viewComponent(view, props),
      {},
      {
        ...options,
        request,
        actions: extra.actions,
        route: view.key,
        params: props.params as Record<string, string> | undefined,
        base: Number.isSafeInteger(base) && base > 0 ? base : undefined,
      },
    );
  } catch (error) {
    endRender(true, error);
    throw error;
  }
  endRender();
  const endStream = event?.traced('stream', 'the rest of the page') ?? (() => {});
  const headers = new Headers(parts.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  // The same URL answers the request for a `#defer` body with that body only, and a navigation,
  // which sends `x-brumate-base`, without the links of the core.
  headers.append('vary', 'x-brumate-defer');
  headers.append('vary', 'x-brumate-base');
  for (const link of links) {
    headers.append('link', link);
  }
  let html = streamParts(parts, { ...options, head: preload + (options.head ?? '') });
  if (event?.trace || event?.tracer) {
    // The trace goes last, once every body has streamed, as JSON that the devtools read.
    const trace = event.trace;
    html = html.pipeThrough(
      new TransformStream<string, string>({
        flush(controller) {
          endStream();
          if (trace) {
            const json = JSON.stringify({ route: path, entries: trace }).replace(/</g, '\\u003c');
            controller.enqueue(`<script type="application/json" b-trace>${json}</script>`);
          }
        },
      }),
    );
  }
  const body = html.pipeThrough(new TextEncoderStream());
  const cache = request.method === 'GET' || request.method === 'HEAD' ? pageCache(view) : undefined;
  if (!cache) {
    return respond(body, { status: extra.status ?? parts.status, headers });
  }
  // A page with `cache` renders in full before its headers go out, so a `#loading` body that
  // reads the user makes it private too.
  const response = respond(await new Response(body).arrayBuffer(), {
    status: extra.status ?? parts.status,
    headers,
  });
  const control = cacheControl(cache, options.event, response);
  if (options.dev) {
    // A browser would keep the page while the files change, so the dev server only says what
    // the page would get.
    response.headers.set('cache-control', 'no-cache');
    response.headers.set('x-brumate-cache', control);
    if (control.startsWith('private') && !warnedPrivate.has(view.key)) {
      warnedPrivate.add(view.key);
      console.warn(
        `The page ${new URL(request.url).pathname} exports cache, but it read cookies or the authorization header, or set a cookie, so it is not cached for everyone. Move what reads the user into #defer.`,
      );
    }
  } else {
    response.headers.set('cache-control', control);
  }
  return response;
}

/**
 * Renders the route again and answers with the body of one `#defer` block:
 * its markup in a `<template b-l>`, the script that swaps it in, and its
 * state. The page renders with the base it had, so its IDs come out the
 * same. When the block is not where the browser has it, such as after the
 * data of the page changed, the answer is 409 and the fallback stays.
 */
async function renderDeferred(
  view: ResolvedView,
  props: Record<string, unknown>,
  request: Request,
  options: RouteOptions,
  defer: { boundary: ScopeId; at: string },
  base: number,
): Promise<Response> {
  const bundles = options.bundles ?? clientBundles;
  const parts = await render(
    viewComponent(view, props),
    {},
    {
      ...options,
      request,
      route: view.key,
      params: props.params as Record<string, string> | undefined,
      base: Number.isSafeInteger(base) && base > 0 ? base : undefined,
      defer,
      // The page that asks for the body has the bundles of its views.
      bundles: bundles && { ...bundles, loaded: viewIds(view) },
    },
  );
  const headers = new Headers(parts.headers);
  headers.append('vary', 'x-brumate-defer');
  if (parts.defer !== 'found') {
    return respond(null, { status: parts.defer === 'moved' ? 409 : 404, headers });
  }
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('x-brumate-defer', String(defer.boundary));
  const body = new ReadableStream<string>({
    async start(controller) {
      try {
        if (parts.pending !== NOTHING_PENDING) {
          for await (const chunk of parts.pending) {
            controller.enqueue(chunk);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  }).pipeThrough(new TextEncoderStream());
  return respond(body, { status: parts.status, headers });
}

/** Runs the server function that a form posted to the page, if any, and renders the page. */
export async function renderRoute(
  match: RouteMatch,
  request: Request,
  url: URL,
  options: RouteOptions,
): Promise<Response> {
  let actions: Map<unknown, unknown> | undefined;
  const event = options.event!;
  if (event.call) {
    const outcome = await runAction(options.functions![event.call.id]!, event);
    if ('answer' in outcome) {
      return outcome.answer;
    }
    actions = outcome.actions;
  }
  // A page that the server kept, for a request that has not read the user so far. Middleware
  // ran before, so a check of access still runs.
  const keep =
    !event.call &&
    !options.dev &&
    options.pageCache !== false &&
    event.kind === 'page' &&
    (request.method === 'GET' || request.method === 'HEAD');
  const key = keep ? pageKey(url, request, options.build) : undefined;
  if (key && !event.personal) {
    const kept = await keptPage(key);
    if (kept) {
      return kept;
    }
  }
  try {
    const view = await resolveView(match.view);
    const response = await renderPage(view, { params: match.params }, request, options, {
      actions,
    });
    if (key && /^\s*public\b/.test(response.headers.get('cache-control') ?? '')) {
      await keepPage(key, response, event);
    }
    return response;
  } catch (error) {
    if (isRedirect(error)) {
      return new Response(null, {
        status: error.status,
        headers: { location: new URL(error.location, url).href },
      });
    }
    if (options.dev && !(error instanceof ServerError)) {
      logError(error, options.event?.kind ?? 'page', options.event?.errors, options.event);
      throw error;
    }
    const page = await renderError(
      match.errors,
      errorAnswer(error, 'Something went wrong', options.event?.kind ?? 'page', options.event),
      match.params,
      request,
      options,
    );
    if (page) {
      return page;
    }
    throw error;
  }
}
