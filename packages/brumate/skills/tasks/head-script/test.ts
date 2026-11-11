import { expect, it } from 'vitest';
import { render } from 'brumate/server';
import Analytics from './src/Analytics.brm?brumate-server';

it('writes the script with data-rerun and the nonce of the render', async () => {
  const request = new Request('http://localhost/');
  const withNonce = await render(Analytics, {}, { request, nonce: 'abc123' });
  expect(withNonce.html).toMatch(
    /<script[^>]*nonce="abc123"[^>]*data-rerun|<script[^>]*data-rerun[^>]*nonce="abc123"/,
  );
  expect(withNonce.html).toContain('window.__seen = (window.__seen || 0) + 1');
});

it('has no nonce attribute without a nonce', async () => {
  const request = new Request('http://localhost/');
  const plain = await render(Analytics, {}, { request });
  expect(plain.html).toContain('data-rerun');
  expect(plain.html).not.toContain('nonce=');
});
