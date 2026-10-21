import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import { errorPage, errorPayload } from '../src/dev-error.ts';
import { codeFrame } from '../src/error.ts';

describe('dev errors', () => {
  it('shows the lines around an offset with a caret', () => {
    const source = 'one\ntwo\nthree x\nfour\nfive\nsix';
    expect(codeFrame(source, source.indexOf('x'))).toBe(
      ['  1 | one', '  2 | two', '> 3 | three x', '    |       ^', '  4 | four', '  5 | five'].join(
        '\n',
      ),
    );
  });

  it('gives the file, line and frame of a compile error to the overlay', () => {
    let error: unknown;
    try {
      compile('<script>\n  let count = $signal(0);\n</script>\n<p>{missing}</p>\n', {
        filename: 'src/Broken.brm',
      });
    } catch (caught) {
      error = caught;
    }
    const payload = errorPayload(error, '/app');
    expect(payload.loc).toEqual({ file: '/app/src/Broken.brm', line: 2, column: 15 });
    expect(payload.frame).toContain('> 2 |   let count = $signal(0);');
    expect(payload.message).toContain("Import $signal from 'brumate/signals'");
    expect(payload.stack).toBe('');
  });

  it('writes a page that loads the overlay, with the error out of reach of the markup', () => {
    const page = errorPage(new Error('</script><b>boom</b>'));
    expect(page).toContain('<script type="module" src="/@vite/client"></script>');
    expect(page).toContain("customElements.get('vite-error-overlay')");
    expect(page).not.toContain('</script><b>');
    expect(page).toContain('\\u003c/script>\\u003cb>boom');
  });
});

describe('dev routes', () => {
  it('throws errors to the dev server instead of rendering _error.brm', async () => {
    const { handleRoute } = await import('../src/runtime/server.ts');
    const sorry = Object.assign(async () => '<p>Sorry</p>', { brumateId: 'Error_1' });
    const tree = {
      page: async () => ({
        default: Object.assign(
          async () => {
            throw new Error('broken');
          },
          { brumateId: 'Page_1' },
        ),
      }),
      error: async () => ({ default: sorry }),
    };
    await expect(
      handleRoute(tree as never, new Request('http://localhost/'), { dev: true }),
    ).rejects.toThrow('broken');
    const answer = await handleRoute(tree as never, new Request('http://localhost/'));
    expect(answer?.status).toBe(500);
  });
});
