// Cookies and sessions, for server functions, rendering, middleware and
// endpoints. They read the request of a `RequestEvent` and write `set-cookie`
// headers on its response.

import type { RequestEvent } from './request.ts';

export interface CookieOptions {
  /** Seconds until the cookie expires. Without it, the cookie lasts until the browser closes. */
  maxAge?: number;
  expires?: Date;
  /** Defaults to `/`. */
  path?: string;
  domain?: string;
  /** Defaults to true when the request is HTTPS. */
  secure?: boolean;
  /** Keeps the cookie from browser code. Defaults to true. */
  httpOnly?: boolean;
  /** Defaults to `lax`. */
  sameSite?: 'strict' | 'lax' | 'none';
}

/** Reads the cookies of a `cookie` header. */
export function parseCookies(header: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) {
      continue;
    }
    const name = part.slice(0, index).trim();
    if (name && !(name in result)) {
      const value = part.slice(index + 1).trim();
      try {
        result[name] = decodeURIComponent(value);
      } catch {
        result[name] = value;
      }
    }
  }
  return result;
}

/** Writes a `set-cookie` header value. */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  if (!/^[\w!#$%&'*+.^`|~-]+$/.test(name)) {
    throw new Error(`"${name}" is not a valid cookie name`);
  }
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? '/'}`];
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  parts.push(
    `SameSite=${(options.sameSite ?? 'lax').replace(/^./, (letter) => letter.toUpperCase())}`,
  );
  return parts.join('; ');
}

/** The cookies of the request, with the ones that this request set or deleted. */
export function getCookies(event: RequestEvent): Record<string, string> {
  const result = parseCookies(event.request.headers.get('cookie'));
  for (const [name, value] of event.cookies ?? []) {
    if (value === undefined) {
      delete result[name];
    } else {
      result[name] = value;
    }
  }
  return result;
}

/** Sets a cookie on the response of an event. See `RequestEvent.setCookie`. */
export function setCookie(
  event: RequestEvent,
  name: string,
  value: string,
  options: CookieOptions = {},
): void {
  const secure = options.secure ?? new URL(event.request.url).protocol === 'https:';
  event.headers.append('set-cookie', serializeCookie(name, value, { ...options, secure }));
  event.cookies ??= new Map();
  event.cookies.set(name, value);
}

/** Deletes a cookie. Pass the `path` and `domain` that it was set with, if they were not the defaults. */
export function deleteCookie(
  event: RequestEvent,
  name: string,
  options: Pick<CookieOptions, 'path' | 'domain'> = {},
): void {
  const secure = new URL(event.request.url).protocol === 'https:';
  event.headers.append(
    'set-cookie',
    serializeCookie(name, '', { ...options, secure, maxAge: 0, expires: new Date(0) }),
  );
  event.cookies ??= new Map();
  event.cookies.set(name, undefined);
}

export interface SessionOptions {
  /**
   * Signs the cookie, so a browser cannot change it. Use a random string of
   * at least 32 characters, kept out of the code, such as in an environment
   * variable. A list signs with the first and accepts all, for changing it.
   */
  secret: string | string[];
  /** The name of the cookie. Defaults to `session`. */
  name?: string;
  /** Seconds until the session expires. Defaults to 7 days. */
  maxAge?: number;
  /** Other options of the cookie. */
  cookie?: Omit<CookieOptions, 'maxAge' | 'expires'>;
}

export interface Session<T> {
  /** The data of the session, or undefined when there is none, it expired, or its signature does not match. */
  get(event: RequestEvent): Promise<T | undefined>;
  /** Replaces the data of the session, and starts its time again. */
  set(event: RequestEvent, data: T): Promise<void>;
  /** Changes some fields of the data, and returns the new data. */
  update(event: RequestEvent, change: Partial<T>): Promise<T>;
  /** Ends the session. */
  clear(event: RequestEvent): void;
}

const encoder = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();

function key(secret: string): Promise<CryptoKey> {
  let promise = keys.get(secret);
  if (!promise) {
    promise = crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
    keys.set(secret, promise);
  }
  return promise;
}

function toBase64Url(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) {
    text += String.fromCharCode(byte);
  }
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/**
 * A session in a signed cookie. The browser can read the data, but cannot
 * change it, so keep secrets out of it: store an ID, and look the rest up
 * on the server.
 *
 * ```ts
 * export const session = createSession<{ userId: string }>({ secret: process.env.SESSION_SECRET! });
 *
 * async function login(form: FormData) {
 *   'use server';
 *   const event = getEvent();
 *   await session.set(event, { userId: await checkPassword(form) });
 * }
 * ```
 */
export function createSession<T>(options: SessionOptions): Session<T> {
  const secrets = Array.isArray(options.secret) ? options.secret : [options.secret];
  if (secrets.length === 0 || secrets.some((secret) => secret.length < 32)) {
    throw new Error('A session secret needs at least 32 characters');
  }
  const name = options.name ?? 'session';
  const maxAge = options.maxAge ?? 7 * 24 * 60 * 60;

  const read = async (event: RequestEvent): Promise<T | undefined> => {
    const value = getCookies(event)[name];
    const dot = value?.lastIndexOf('.') ?? -1;
    if (!value || dot === -1) {
      return undefined;
    }
    const payload = value.slice(0, dot);
    let signature: Uint8Array<ArrayBuffer>;
    try {
      signature = fromBase64Url(value.slice(dot + 1));
    } catch {
      return undefined;
    }
    // Any of the secrets can have signed it, such as an older one while a secret changes.
    const checks = await Promise.all(
      secrets.map(async (secret) =>
        crypto.subtle.verify('HMAC', await key(secret), signature, encoder.encode(payload)),
      ),
    );
    if (!checks.includes(true)) {
      return undefined;
    }
    try {
      const { d: data, e: expires } = JSON.parse(
        new TextDecoder().decode(fromBase64Url(payload)),
      ) as {
        d: T;
        e: number;
      };
      return expires > Date.now() ? data : undefined;
    } catch {
      return undefined;
    }
  };

  const write = async (event: RequestEvent, data: T): Promise<void> => {
    const payload = toBase64Url(
      encoder.encode(JSON.stringify({ d: data, e: Date.now() + maxAge * 1000 })),
    );
    const signature = new Uint8Array(
      await crypto.subtle.sign('HMAC', await key(secrets[0]!), encoder.encode(payload)),
    );
    const value = `${payload}.${toBase64Url(signature)}`;
    // Browsers drop cookies over about 4 KB.
    if (value.length > 4000) {
      throw new Error(
        `The session is ${value.length} bytes, over the 4000 that a cookie can hold. Store an ID in it instead`,
      );
    }
    setCookie(event, name, value, { ...options.cookie, maxAge });
  };

  return {
    get: read,
    set: write,
    async update(event, change) {
      const data = { ...(await read(event)), ...change } as T;
      await write(event, data);
      return data;
    },
    clear: (event) =>
      deleteCookie(event, name, { path: options.cookie?.path, domain: options.cookie?.domain }),
  };
}

/**
 * The headers of a response for Node's `writeHead`, with each `set-cookie`
 * apart. `Object.fromEntries(headers)` joins them into one, which browsers
 * read as a single cookie.
 */
export function toNodeHeaders(headers: Headers): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = Object.fromEntries(headers);
  const cookies = headers.getSetCookie();
  if (cookies.length > 0) {
    result['set-cookie'] = cookies;
  }
  return result;
}
