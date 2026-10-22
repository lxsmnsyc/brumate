import { afterEach, describe, expect, it, vi } from 'vitest';

/** A stand-in for the browser's Trusted Types, which records the policies it made and their calls. */
function stubTrustedTypes(allowed = true): {
  policies: string[];
  html: string[];
  scripts: string[];
} {
  const record = { policies: [] as string[], html: [] as string[], scripts: [] as string[] };
  vi.stubGlobal('trustedTypes', {
    createPolicy(
      name: string,
      rules: { createHTML(html: string): string; createScript(code: string): string },
    ) {
      if (!allowed) {
        throw new TypeError(`Policy "${name}" disallowed`);
      }
      record.policies.push(name);
      return {
        createHTML: (html: string) => {
          record.html.push(html);
          return rules.createHTML(html);
        },
        createScript: (code: string) => {
          record.scripts.push(code);
          return rules.createScript(code);
        },
      };
    },
  });
  return record;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Trusted Types', () => {
  it('passes markup and scripts through one policy named brumate, made on the first insert', async () => {
    const record = stubTrustedTypes();
    const { trustedHTML, trustedScript } = await import('../src/runtime/trusted.ts');
    expect(record.policies).toEqual([]);
    expect(trustedHTML('<p>Hi</p>')).toBe('<p>Hi</p>');
    expect(trustedScript('$bS(1)')).toBe('$bS(1)');
    expect(trustedHTML('<p>Again</p>')).toBe('<p>Again</p>');
    expect(record.policies).toEqual(['brumate']);
    expect(record.html).toEqual(['<p>Hi</p>', '<p>Again</p>']);
    expect(record.scripts).toEqual(['$bS(1)']);
  });

  it('passes strings as they are where the browser has no Trusted Types', async () => {
    const { trustedHTML, trustedScript } = await import('../src/runtime/trusted.ts');
    expect(trustedHTML('<p>Hi</p>')).toBe('<p>Hi</p>');
    expect(trustedScript('1')).toBe('1');
  });

  it('says which directive the policy of the site needs when it refuses the policy', async () => {
    stubTrustedTypes(false);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { trustedHTML } = await import('../src/runtime/trusted.ts');
      expect(trustedHTML('<p>Hi</p>')).toBe('<p>Hi</p>');
      expect(trustedHTML('<p>Hi</p>')).toBe('<p>Hi</p>');
      expect(errors).toHaveBeenCalledTimes(1);
      expect(errors.mock.calls[0]![0]).toContain('Add "trusted-types brumate"');
    } finally {
      errors.mockRestore();
    }
  });
});
