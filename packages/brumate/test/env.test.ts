import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { clientEnvModule, parseEnvFile } from '../src/env-file.ts';
import { compile } from '../src/index.ts';
import { defineEnv } from '../src/runtime/env.ts';

const schema = {
  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
    SESSION_SECRET: v.pipe(v.string(), v.minLength(8)),
  },
  public: {
    SITE_NAME: v.optional(v.string(), 'Tracker'),
  },
};

describe('defineEnv', () => {
  it('gives the values of the variables, with the defaults of the schemas', () => {
    const env = defineEnv(schema, {
      source: { DATABASE_URL: 'postgres://db', SESSION_SECRET: 'hunter22' },
    });
    expect(env).toEqual({
      DATABASE_URL: 'postgres://db',
      SESSION_SECRET: 'hunter22',
      SITE_NAME: 'Tracker',
    });
    expect(Object.isFrozen(env)).toBe(true);
    // The types follow the schemas.
    const name: string = env.SITE_NAME;
    expect(name).toBe('Tracker');
  });

  it('fails with every missing or wrong variable', () => {
    expect(() =>
      defineEnv(schema, { source: { DATABASE_URL: 'not a url', SITE_NAME: 'x' } }),
    ).toThrow(
      'Environment variables: DATABASE_URL is invalid: Invalid URL: Received "not a url". SESSION_SECRET is missing',
    );
  });

  it('reads process.env without a source', () => {
    process.env.BRUMATE_TEST_VALUE = 'yes';
    try {
      expect(defineEnv({ public: { BRUMATE_TEST_VALUE: v.string() } })).toEqual({
        BRUMATE_TEST_VALUE: 'yes',
      });
    } finally {
      delete process.env.BRUMATE_TEST_VALUE;
    }
  });

  it('refuses a schema that validates asynchronously', () => {
    expect(() =>
      defineEnv({
        server: {
          KEY: v.pipeAsync(
            v.string(),
            v.checkAsync(async () => true),
          ),
        },
      }),
    ).toThrow('The schema of KEY validates asynchronously');
  });
});

const source = `import { defineEnv } from 'brumate/env';
import * as v from 'valibot';

export default defineEnv({
  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
    SESSION_SECRET: v.pipe(v.string(), v.minLength(8)),
  },
  public: {
    SITE_NAME: v.optional(v.string(), 'Tracker'),
    API_URL: v.string(),
  },
});
`;

describe('the env file', () => {
  it('reads the names of the server and the public variables', () => {
    const file = parseEnvFile(source, 'env.ts');
    expect(file.server).toEqual(['DATABASE_URL', 'SESSION_SECRET']);
    expect(file.public).toEqual(['SITE_NAME', 'API_URL']);
  });

  it('writes the copy of the browser without the server variables, with the public values', () => {
    const code = clientEnvModule(source, 'env.ts', {
      API_URL: 'https://api.example',
      DATABASE_URL: 'postgres://db',
    });
    expect(code).not.toContain('DATABASE_URL');
    expect(code).not.toContain('SESSION_SECRET');
    expect(code).toContain(
      'public: {\n    SITE_NAME: v.optional(v.string(), \'Tracker\'),\n    API_URL: v.string(),\n  },\n}, { source: {"API_URL":"https://api.example"} });',
    );
  });

  it('keeps a file without server variables as it is, apart from the values', () => {
    const code = clientEnvModule(
      "import { defineEnv } from 'brumate/env';\nexport default defineEnv({ public: { A: v.string() } });\n",
      'env.ts',
      { A: '1' },
    );
    expect(code).toContain('defineEnv({ public: { A: v.string() } }, { source: {"A":"1"} });');
  });

  it.each([
    ['a schema that is not written in the call', 'export default defineEnv(schema);'],
    [
      'a group that is not an object literal',
      'export default defineEnv({ server: serverSchemas });',
    ],
    ['a group other than server and public', 'export default defineEnv({ shared: {} });'],
  ])('refuses %s', (_, code) => {
    expect(() => parseEnvFile(code, 'env.ts')).toThrow('env.ts');
  });
});

/** The server variables of `./env.ts`, as the plugin tells the compiler. */
const envImport = (specifier: string): string[] | undefined =>
  specifier === './env.ts' ? ['DATABASE_URL'] : undefined;

/** A component that imports the env file, with a script and markup of its own. */
function component(script: string, markup: string): string {
  return `<script>\n  import { $signal } from 'brumate/signals';\n  import env from './env.ts';\n  let shown = $signal('');\n${script}</script>\n${markup}`;
}

describe('server variables in components', () => {
  it('compile when the server reads them while the page renders', () => {
    const { server } = compile(
      component(
        '  const label = `${env.SITE_NAME} at ${env.DATABASE_URL.length}`;\n',
        '<p>{label}</p>\n<button onClick=(() => (shown = env.SITE_NAME))>{shown}</button>',
      ),
      { filename: 'Env.brm', envImport },
    );
    expect(server).toContain("import env from './env.ts';");
  });

  it('fail to compile when a handler reads one', () => {
    expect(() =>
      compile(
        component('', '<button onClick=(() => (shown = env.DATABASE_URL))>{shown}</button>'),
        { filename: 'Env.brm', envImport },
      ),
    ).toThrow(
      'env.DATABASE_URL, a server variable, is read by code that runs in the browser (event button.click). Read it in a server function',
    );
  });

  it('fail to compile when a handler reads the whole object', () => {
    expect(() =>
      compile(component('', '<button onClick=(() => console.log(env))>{shown}</button>'), {
        filename: 'Env.brm',
        envImport,
      }),
    ).toThrow('env, with its server variables, is read by code that runs in the browser');
  });

  it('fail to compile when a value made from one would go to the browser', () => {
    expect(() =>
      compile(
        component(
          '  let url = $signal(env.DATABASE_URL);\n',
          '<button onClick=(() => (shown = url))>{shown}</button>',
        ),
        { filename: 'Env.brm', envImport },
      ),
    ).toThrow(
      '"url" holds env.DATABASE_URL, a server variable, and code that runs in the browser reads it',
    );
  });

  it('compile without the plugin, which knows the env file', () => {
    expect(() =>
      compile(
        component('', '<button onClick=(() => (shown = env.DATABASE_URL))>{shown}</button>'),
        {
          filename: 'Env.brm',
        },
      ),
    ).not.toThrow();
  });
});
