import { MACROS, checkMacroImports, isMacroImport, resolveMacros } from './macros.ts';
import type {
  Block,
  Body,
  ComponentNode,
  DynamicTagNode,
  ElementNode,
  EventAttribute,
  Expression,
  Markup,
  Range,
  RefAttribute,
  SFCFile,
  TemplateDecl,
} from './ast.ts';
import { lookup, upstreamMemos } from './model.ts';
import { KEY_NAMES } from './runtime/events.ts';
import type {
  Declaration,
  DeclarationKind,
  Diagnostic,
  Reference,
  Scope,
  ScopeKind,
  SemanticModel,
  Site,
  SiteKind,
} from './model.ts';
import { children, getPatternNames } from './oxc.ts';
import type { oxc } from './oxc.ts';

/** Methods that change an array, a `Map` or a `Set` in place. */
const MUTATORS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
  'set',
  'add',
  'delete',
  'clear',
]);

/** Declarations whose value the client tracks. Changing their value in place updates nothing. */
const REACTIVE = new Set<string>([
  'signal',
  'memo',
  'async-memo',
  'prop',
  'props-rest',
  'item',
  'action',
]);

/** The module of the wrappers of event handlers, which the compiler reads. */
const EVENTS_MODULE = 'brumate/events';
/** The wrappers that `brumate/events` exports. */
const WRAPPERS = new Set(['prevent', 'stop', 'once', 'capture']);
/** The events whose `prevent` can name keys. */
const KEY_EVENTS = new Set(['keydown', 'keyup', 'keypress']);

const COMPILE_TIME_FUNCTIONS = MACROS;

const MISPLACED: Record<string, string> = {
  $setContext: 'Call $setContext at the top level of a script',
  $title: 'Call $title at the top level of a script',
  $id: 'Create an ID with "const name = $id()" at the top level of a script',
  $getContext:
    'Read a context with "const name = $getContext(Context)" at the top level of a script',
  $route: 'Read the route with "const name = $route()" at the top level of a script',
  $navigation: 'Read the navigation with "const name = $navigation()" at the top level of a script',
  $props: 'Call $props() as the value of a const in the component script',
  $signal: 'Declare a signal with "let name = $signal(value)" at the top level of a script',
  $memo: 'Declare a memo with "const name = $memo(value)" at the top level of a script',
  $debounced:
    'Declare a debounced value with "const name = $debounced(value, ms)" at the top level of a script',
  $throttled:
    'Declare a throttled value with "const name = $throttled(value, ms)" at the top level of a script',
  $optimistic:
    'Declare an optimistic value with "let name = $optimistic(source)" at the top level of a script',
  $action:
    'Declare the result of a form with "const name = $action(serverFunction)" at the top level of a script',
  $effect: 'Call $effect at the top level of a script',
  $client: 'Call $client at the top level of a script',
};

const REMOVED: Record<string, string> = {
  $ref: '$ref is not supported. Use a $signal with ref=name',
  $watch: '$watch is not supported. Use $effect',
  $settled: '$settled is not supported. Use $client',
  $cleanup: '$cleanup is not supported. Return a cleanup function from $effect or $client',
  $store: '$store is not supported yet',
  $get: '$get is not supported. Signals cannot leave the file',
  $set: '$set is not supported. Signals cannot leave the file',
};

const CLIENT_TRIGGERS = new Set(['visible', 'idle', 'load']);

// Kinds that a write can target.
const WRITABLE = new Set<DeclarationKind>(['signal', 'let']);

// Sites that run in response to an event, so they can write signals.
const WRITING_SITES = new Set<SiteKind>(['function', 'event', 'effect', 'client']);

// Declarations that a server function can capture.
const SERVER_CAPTURABLE = new Set<DeclarationKind>(['import', 'module', 'server-function']);

const TYPE_KEYS = new Set([
  'typeAnnotation',
  'typeParameters',
  'typeArguments',
  'returnType',
  'superTypeArguments',
  'implements',
]);

const TYPE_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

type Fn = oxc.Function | oxc.ArrowFunctionExpression;

function isFunction(node: oxc.Node | null | undefined): node is Fn {
  return (
    node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionExpression' ||
    node?.type === 'FunctionDeclaration'
  );
}

function hasUseServer(fn: Fn): boolean {
  const body = fn.body;
  if (!body || body.type !== 'BlockStatement') {
    return false;
  }
  for (const statement of body.body) {
    if (statement.type !== 'ExpressionStatement' || typeof statement.directive !== 'string') {
      return false;
    }
    if (statement.directive === 'use server') {
      return true;
    }
  }
  return false;
}

/** Returns the name of a compile-time function that `node` calls, if any. */
function calleeName(node: oxc.Node | null | undefined): string | undefined {
  if (node?.type === 'CallExpression' && node.callee.type === 'Identifier') {
    return node.callee.name;
  }
  return undefined;
}

function range(node: Range): Range {
  return { start: node.start, end: node.end };
}

export function analyze(file: SFCFile): SemanticModel {
  return new Analyzer(file).run();
}

class Analyzer {
  private readonly file: SFCFile;
  private readonly scopes: Scope[] = [];
  private readonly declarations: Declaration[] = [];
  private readonly sites: Site[] = [];
  readonly bindings: { call: oxc.CallExpression; declaration: Declaration }[] = [];
  private readonly diagnostics: Diagnostic[] = [];
  private readonly refs: { attribute: RefAttribute; element: ElementNode; scope: Scope }[] = [];
  private readonly module: Scope;
  private readonly component: Scope;

  constructor(file: SFCFile) {
    this.file = file;
    this.module = this.createScope('module', undefined);
    this.component = this.createScope('component', this.module);
  }

  run(): SemanticModel {
    const { imported, diagnostics } = resolveMacros(this.file);
    this.diagnostics.push(...diagnostics, ...checkMacroImports(this.file, imported));
    if (this.file.moduleScript) {
      this.declareModuleScript(this.file.moduleScript.program);
    }
    if (this.file.instanceScript) {
      this.declareScript(this.file.instanceScript.program, this.component, true);
    }
    for (const template of this.file.templates) {
      this.declareTemplate(template, this.component);
    }
    for (const style of this.file.styles) {
      for (const variable of style.variables) {
        this.createExpressionSite('style', this.component, variable, 'style');
      }
    }
    this.visitNodes(this.file.children, this.component);
    this.addProvidedFunctions();

    for (const site of this.sites) {
      new Resolver(this, site).run();
    }
    this.addPendingReads();
    this.resolveRefs();
    this.check();

    return {
      module: this.module,
      component: this.component,
      scopes: this.scopes,
      declarations: this.declarations,
      sites: this.sites,
      bindings: this.bindings,
      diagnostics: this.diagnostics,
    };
  }

  /** `$isPending(memo)` calls, which also read the memos that the memo reads. */
  readonly pendingCalls: { reference: Reference; at: Range }[] = [];

  /**
   * A memo is pending while a memo that it reads loads. `$isPending(memo)`
   * reads those memos too, so it updates when they start and stop loading.
   */
  private addPendingReads(): void {
    for (const { reference, at } of this.pendingCalls) {
      for (const declaration of upstreamMemos(reference.declaration)) {
        // An empty range after the call, which no identifier starts at.
        const read: Reference = {
          ...reference,
          declaration,
          range: { start: at.end, end: at.end },
        };
        declaration.reads.push(read);
        reference.site.reads.push(read);
      }
    }
  }

  report(severity: Diagnostic['severity'], message: string, at: Range): void {
    this.diagnostics.push({ severity, message, range: range(at) });
  }

  // Scopes and declarations

  private createScope(
    kind: ScopeKind,
    parent: Scope | undefined,
    extra: Partial<Scope> = {},
  ): Scope {
    const scope: Scope = {
      id: this.scopes.length,
      kind,
      parent,
      children: [],
      declarations: new Map(),
      ...extra,
    };
    parent?.children.push(scope);
    this.scopes.push(scope);
    return scope;
  }

  private addDeclaration(
    scope: Scope,
    name: string,
    kind: DeclarationKind,
    at: Range,
    block?: Block,
  ): Declaration {
    if (scope.declarations.has(name)) {
      this.report('error', `"${name}" is already declared`, at);
    }
    const declaration: Declaration = {
      id: this.declarations.length,
      name,
      kind,
      scope,
      range: range(at),
      block,
      reads: [],
      writes: [],
      refs: [],
    };
    scope.declarations.set(name, declaration);
    this.declarations.push(declaration);
    return declaration;
  }

  private createSite(
    kind: SiteKind,
    scope: Scope,
    node: oxc.Node,
    label: string,
    extra: Partial<Site> = {},
  ): Site {
    const site: Site = {
      id: this.sites.length,
      kind,
      scope,
      range: range(node),
      node,
      label,
      reads: [],
      writes: [],
      calls: new Set(),
      trackedCalls: new Set(),
      awaits: false,
      ...extra,
    };
    this.sites.push(site);
    return site;
  }

  private createExpressionSite(
    kind: SiteKind,
    scope: Scope,
    expression: Expression,
    label: string,
    extra: Partial<Site> = {},
  ): Site {
    const site = this.createSite(kind, scope, expression.ast, label, extra);
    site.range = range(expression);
    return site;
  }

  /**
   * Reads the wrappers of `brumate/events` around a handler, such as
   * `prevent(move, 'Enter')`, into the modifiers that `b-on` holds, so the
   * loader applies them before the handler's code loads. A modifier in the
   * attribute name, such as `onSubmit:prevent`, still works, with a warning.
   */
  private readWrappers(site: Site, attribute: EventAttribute, scope: Scope): void {
    if (attribute.modifiers.length > 0) {
      const [first] = attribute.modifiers;
      this.report(
        'warning',
        `${attribute.name}:${first} is replaced by ${attribute.name}=(${first === 'passive' ? 'handler' : `${first}(handler)`}) from brumate/events${first === 'passive' ? ', since listeners are passive unless a handler prevents' : ''}`,
        attribute,
      );
    }
    const modifiers: string[] = [];
    let node: oxc.Node = attribute.handler.ast;
    for (;;) {
      while (node.type === 'ParenthesizedExpression') {
        node = node.expression;
      }
      if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
        break;
      }
      const imported = lookup(scope, node.callee.name)?.imported;
      const name = imported?.source === EVENTS_MODULE ? imported.name : undefined;
      if (name === undefined || !WRAPPERS.has(name)) {
        break;
      }
      const [handler, ...rest]: oxc.Node[] = node.arguments;
      if (!handler || (name !== 'prevent' && rest.length > 0)) {
        this.report('error', `${name} takes a handler`, node);
        break;
      }
      if (rest.length > 0) {
        const keys = rest.map((key) =>
          key.type === 'Literal' && typeof key.value === 'string' ? key.value : undefined,
        );
        const wrong = rest.find((_, index) => {
          const key = keys[index];
          return key === undefined || !(KEY_NAMES.includes(key) || /^[A-Za-z0-9]$/.test(key));
        });
        if (!KEY_EVENTS.has(attribute.event)) {
          this.report(
            'error',
            'Only prevent of a keyboard event takes keys, such as onKeyDown',
            node,
          );
        } else if (wrong) {
          this.report(
            'error',
            "Name each key of prevent as a string of its event.key, such as 'ArrowDown', 'Space' or 'a'",
            wrong,
          );
        }
        modifiers.push(`prevent(${keys.join(',')})`);
      } else {
        modifiers.push(name);
      }
      node = handler;
    }
    if (modifiers.length > 0) {
      site.modifiers = modifiers;
    }
  }

  private declareFunction(name: string, fn: Fn, scope: Scope, at: Range): void {
    const server = hasUseServer(fn);
    const kind = server ? 'server-function' : 'function';
    const declaration = this.addDeclaration(scope, name, kind, at);
    const site = this.createSite(
      kind,
      scope,
      fn,
      `${server ? 'server function' : 'function'} ${name}`,
      {
        declaration,
      },
    );
    site.range = range(at);
    declaration.site = site;
    if (server && !fn.async) {
      this.report('error', `Server function "${name}" must be async`, at);
    }
  }

  private declareModuleScript(program: oxc.Program): void {
    for (const statement of program.body) {
      if (statement.type === 'ImportDeclaration') {
        this.declareImport(statement, this.module);
      } else if (statement.type === 'ExportDefaultDeclaration') {
        this.report('error', 'The module script cannot have a default export', statement);
      } else if (statement.type === 'ExportNamedDeclaration') {
        if (statement.declaration) {
          this.declareModuleStatement(statement.declaration);
        }
      } else {
        this.declareModuleStatement(statement);
      }
    }
  }

  private declareModuleStatement(statement: oxc.Node): void {
    switch (statement.type) {
      case 'FunctionDeclaration':
        if (statement.id) {
          const server = hasUseServer(statement);
          this.addDeclaration(
            this.module,
            statement.id.name,
            server ? 'server-function' : 'module',
            statement.id,
          );
          if (server && !statement.async) {
            this.report(
              'error',
              `Server function "${statement.id.name}" must be async`,
              statement.id,
            );
          }
        }
        break;
      case 'VariableDeclaration':
        for (const declarator of statement.declarations) {
          const init = declarator.init;
          const server =
            declarator.id.type === 'Identifier' && isFunction(init) && hasUseServer(init);
          for (const name of getPatternNames(declarator.id)) {
            this.addDeclaration(
              this.module,
              name.name,
              server ? 'server-function' : 'module',
              name,
            );
          }
        }
        break;
      case 'ClassDeclaration':
      case 'TSEnumDeclaration':
        if (statement.id) {
          this.addDeclaration(this.module, statement.id.name, 'module', statement.id);
        }
        break;
      default:
        break;
    }
  }

  private declareImport(statement: oxc.ImportDeclaration, scope: Scope): void {
    // Compile-time functions are not values. The compiler replaces their calls.
    if (statement.importKind === 'type' || isMacroImport(statement)) {
      return;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportSpecifier' && specifier.importKind === 'type') {
        continue;
      }
      const declaration = this.addDeclaration(
        scope,
        specifier.local.name,
        'import',
        specifier.local,
      );
      if (specifier.type !== 'ImportNamespaceSpecifier') {
        let imported = 'default';
        if (specifier.type !== 'ImportDefaultSpecifier') {
          imported =
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value;
        }
        declaration.imported = { source: statement.source.value, name: imported };
      }
    }
  }

  /** Declares the statements of the component script or a block script. */
  private declareScript(program: oxc.Program, scope: Scope, isComponent: boolean): void {
    for (const statement of program.body) {
      switch (statement.type) {
        case 'ImportDeclaration':
          // Imports move to the top of the module.
          this.declareImport(statement, isComponent ? this.module : scope);
          break;
        case 'ExportNamedDeclaration':
        case 'ExportDefaultDeclaration':
        case 'ExportAllDeclaration':
        case 'TSExportAssignment':
          if (
            !('exportKind' in statement && statement.exportKind === 'type') &&
            !this.isTypeExport(statement)
          ) {
            this.report('error', 'A script cannot export values. Use <script module>', statement);
          }
          break;
        case 'TSInterfaceDeclaration':
        case 'TSTypeAliasDeclaration':
        case 'TSDeclareFunction':
        case 'TSModuleDeclaration':
          break;
        case 'FunctionDeclaration':
          if (statement.id) {
            this.declareFunction(statement.id.name, statement, scope, statement.id);
          }
          break;
        case 'VariableDeclaration':
          for (const declarator of statement.declarations) {
            this.declareVariable(declarator, statement.kind, scope, isComponent);
          }
          break;
        case 'ClassDeclaration':
        case 'TSEnumDeclaration':
          if (statement.id) {
            this.addDeclaration(scope, statement.id.name, 'const', statement.id);
          }
          this.createSite('setup', scope, statement, 'setup');
          break;
        case 'ExpressionStatement': {
          const name = calleeName(statement.expression);
          if (name === '$title') {
            const call = statement.expression as oxc.CallExpression;
            if (call.arguments.length !== 1) {
              this.report('error', '$title takes one argument, the title', call);
            } else {
              this.report(
                'warning',
                '$title is replaced by <title> in #head, such as #head { <title>{`${count} left`}</title> }, and goes in a later version',
                call,
              );
              this.createSite('title', scope, call.arguments[0]!, 'title');
            }
          } else if (name === '$setContext') {
            this.declareProvide(statement.expression as oxc.CallExpression, scope);
          } else if (name === '$effect' || name === '$client') {
            this.declareEffect(statement.expression as oxc.CallExpression, name, scope);
          } else {
            this.createSite('setup', scope, statement, 'setup');
          }
          break;
        }
        default:
          this.createSite('setup', scope, statement, 'setup');
          break;
      }
    }
  }

  private isTypeExport(statement: oxc.Node): boolean {
    if (statement.type !== 'ExportNamedDeclaration' || !statement.declaration) {
      return false;
    }
    const type = statement.declaration.type;
    return type === 'TSInterfaceDeclaration' || type === 'TSTypeAliasDeclaration';
  }

  private declareVariable(
    declarator: oxc.VariableDeclarator,
    kind: oxc.VariableDeclaration['kind'],
    scope: Scope,
    isComponent: boolean,
  ): void {
    const id = declarator.id;
    // `const name = await $memo(value)` declares a memo that the render waits for.
    const awaited = declarator.init?.type === 'AwaitExpression' ? declarator.init : undefined;
    const awaitedName = awaited && calleeName(awaited.argument);
    if (
      awaited &&
      awaitedName !== undefined &&
      MACROS.has(awaitedName) &&
      awaitedName !== '$memo'
    ) {
      this.report('error', `await works with $memo, not ${awaitedName}`, awaited);
    }
    const init = awaitedName === '$memo' ? awaited!.argument : declarator.init;
    const name = calleeName(init);
    const call = init as oxc.CallExpression;

    if (name === '$props') {
      if (!isComponent) {
        this.report('error', '$props() can only be called in the component script', declarator);
      }
      // `let` makes the props that it destructures writable: the component writes its own copy,
      // or, when a parent binds the prop with `$bind`, the parent's signal.
      if (kind !== 'const' && kind !== 'let') {
        this.report('error', 'Assign $props() to a const or a let', declarator);
      }
      if (call.arguments.length > 0) {
        this.report('error', '$props() takes no arguments', call);
      }
      if (id.type === 'ObjectPattern') {
        for (const property of id.properties) {
          if (property.type === 'RestElement') {
            for (const binding of getPatternNames(property.argument)) {
              this.addDeclaration(scope, binding.name, 'props-rest', binding);
            }
          } else {
            let key: string | undefined;
            if (!property.computed) {
              key =
                property.key.type === 'Identifier'
                  ? property.key.name
                  : String((property.key as { value?: unknown }).value);
            }
            for (const binding of getPatternNames(property.value)) {
              const declaration = this.addDeclaration(scope, binding.name, 'prop', binding);
              declaration.propKey = key;
              if (kind === 'let') {
                declaration.writable = true;
              }
            }
          }
        }
        this.createDefaultSites(id, scope);
      } else if (id.type === 'Identifier') {
        this.addDeclaration(scope, id.name, 'prop', id);
      } else {
        this.report('error', 'Assign $props() to a name or an object pattern', id);
      }
      return;
    }

    if (name === '$id') {
      if (kind !== 'const' || id.type !== 'Identifier') {
        this.report('error', 'Create an ID with "const name = $id()"', declarator);
        return;
      }
      if (call.arguments.length > 0) {
        this.report('error', '$id takes no arguments', call);
      }
      const declaration = this.addDeclaration(scope, id.name, 'const', id);
      declaration.idIndex = [...scope.declarations.values()].filter(
        (item) => item.idIndex !== undefined,
      ).length;
      return;
    }

    if (name === '$route' || name === '$navigation') {
      if (kind !== 'const' || id.type !== 'Identifier') {
        this.report('error', MISPLACED[name]!, declarator);
        return;
      }
      if (name === '$navigation' ? call.arguments.length > 0 : call.arguments.length > 1) {
        this.report(
          'error',
          name === '$navigation'
            ? '$navigation takes no arguments'
            : '$route takes at most one argument, the path of the route',
          call,
        );
      }
      // A context that the runtime provides, so it changes when navigation changes the page.
      this.addDeclaration(scope, id.name, 'context', id);
      return;
    }

    if (name === '$getContext') {
      if (kind !== 'const' || id.type !== 'Identifier') {
        this.report('error', 'Read a context with "const name = $getContext(Context)"', declarator);
        return;
      }
      if (call.arguments.length !== 1) {
        this.report('error', '$getContext takes one argument, the context', call);
      }
      this.addDeclaration(scope, id.name, 'context', id);
      const argument = call.arguments[0];
      if (argument) {
        this.createSite('setup', scope, argument, `context ${id.name}`);
      }
      return;
    }

    if (name === '$action') {
      const argument = call.arguments[0];
      if (kind !== 'const' || id.type !== 'Identifier') {
        this.report(
          'error',
          'Declare the result of a form with "const name = $action(serverFunction)"',
          declarator,
        );
        return;
      }
      if (argument?.type !== 'Identifier' || call.arguments.length !== 1) {
        this.report(
          'error',
          '$action needs a server function of this file as its only argument',
          call,
        );
        return;
      }
      const declaration = this.addDeclaration(scope, id.name, 'action', id);
      declaration.action = argument.name;
      return;
    }

    if (name === '$debounced' || name === '$throttled') {
      if (kind !== 'const') {
        this.report('error', `Declare ${name} with const`, declarator);
      }
      if (id.type !== 'Identifier') {
        this.report('error', `${name} cannot be destructured`, id);
        return;
      }
      const [argument, wait] = call.arguments;
      const declaration = this.addDeclaration(scope, id.name, 'memo', id);
      if (!argument || call.arguments.length !== 2) {
        this.report('error', `${name} takes a value and a wait in milliseconds`, call);
        return;
      }
      const ms = wait?.type === 'Literal' && typeof wait.value === 'number' ? wait.value : NaN;
      // A timer cannot wait longer than 2^31 - 1 ms, and fires at once for a longer wait.
      if (!(ms >= 0 && ms <= 2147483647)) {
        this.report(
          'error',
          `The wait of ${name} must be a number of milliseconds, such as 300`,
          wait!,
        );
      }
      declaration.timing = { kind: name === '$debounced' ? 'debounced' : 'throttled', ms };
      declaration.site = this.createSite('memo', scope, argument, `memo ${id.name}`, {
        declaration,
      });
      return;
    }

    if (name === '$signal' || name === '$memo' || name === '$optimistic') {
      const expected = name === '$memo' ? 'const' : 'let';
      if (kind !== expected) {
        this.report('error', `Declare ${name} with ${expected}`, declarator);
      }
      if (id.type !== 'Identifier') {
        this.report('error', `${name} cannot be destructured`, id);
        return;
      }
      if (call.arguments.length > 1) {
        this.report('error', `${name} takes one argument`, call);
      }
      const argument = call.arguments[0];
      if (name === '$signal') {
        const declaration = this.addDeclaration(scope, id.name, 'signal', id);
        if (argument) {
          declaration.init = argument;
          this.createSite('setup', scope, argument, `signal ${id.name}`);
        }
        return;
      }
      const declaration = this.addDeclaration(scope, id.name, 'memo', id);
      if (awaited && name === '$memo') {
        declaration.awaited = true;
      }
      if (!argument) {
        this.report('error', `${name} needs a value`, call);
        return;
      }
      if (name === '$optimistic') {
        // A memo of its source, which handlers can write.
        declaration.writable = true;
        if (argument.type !== 'Identifier') {
          this.report('error', '$optimistic needs the name of a value, such as a memo', argument);
        }
      }
      declaration.site = this.createSite('memo', scope, argument, `memo ${id.name}`, {
        declaration,
      });
      return;
    }

    if (name === '$effect' || name === '$client') {
      this.report('error', `${name} does not return a value`, call);
      return;
    }

    if (kind === 'const' && id.type === 'Identifier' && isFunction(init)) {
      this.declareFunction(id.name, init, scope, id);
      return;
    }

    for (const binding of getPatternNames(id)) {
      this.addDeclaration(scope, binding.name, kind === 'const' ? 'const' : 'let', binding);
    }
    this.createDefaultSites(id, scope);
    if (init) {
      this.createSite('setup', scope, init, 'setup');
    }
  }

  /** Creates setup sites for the default values and computed keys of a pattern. */
  private createDefaultSites(pattern: oxc.Node, scope: Scope): void {
    switch (pattern.type) {
      case 'AssignmentPattern':
        this.createSite('setup', scope, pattern.right, 'default');
        this.createDefaultSites(pattern.left, scope);
        break;
      case 'ObjectPattern':
        for (const property of pattern.properties) {
          if (property.type === 'RestElement') {
            this.createDefaultSites(property.argument, scope);
          } else {
            if (property.computed) {
              this.createSite('setup', scope, property.key, 'key');
            }
            this.createDefaultSites(property.value, scope);
          }
        }
        break;
      case 'ArrayPattern':
        for (const element of pattern.elements) {
          if (element) {
            this.createDefaultSites(element, scope);
          }
        }
        break;
      case 'RestElement':
        this.createDefaultSites(pattern.argument, scope);
        break;
      default:
        break;
    }
  }

  /**
   * Functions in a provided value run in the browser, where a component that
   * reads the context calls them. Each one is a client root, as a function
   * prop is: the value itself, or the value of a key of an object, such as
   * `toggle` in `$setContext(Theme, { theme, toggle })`.
   */
  private addProvidedFunctions(): void {
    for (const site of this.sites.filter((item) => item.kind === 'provide')) {
      const value = site.node;
      const parts =
        value.type === 'ObjectExpression'
          ? value.properties.flatMap((property) =>
              property.type === 'Property' && !property.computed ? [property.value] : [],
            )
          : [value];
      for (const part of parts) {
        const isFunctionPart =
          isFunction(part) ||
          (part.type === 'Identifier' &&
            ['function', 'server-function'].includes(lookup(site.scope, part.name)?.kind ?? ''));
        if (isFunctionPart) {
          this.createSite('prop', site.scope, part, 'provided function');
        }
      }
    }
  }

  /**
   * `$handler(fn, ...args)`: `fn` is a client root, as a function prop is, and
   * its reference goes with the arguments. `isLocal` tells a name that a
   * function around the call declares: `fn` cannot read one, since only the
   * values of the scope and the arguments reach the browser.
   */
  declareHandler(call: oxc.CallExpression, scope: Scope, isLocal: (name: string) => boolean): void {
    const [fn] = call.arguments;
    if (!fn || fn.type === 'SpreadElement' || !this.isHandlerFunction(fn, scope)) {
      this.report(
        'error',
        '$handler needs a function as its first argument: a function expression, a function of the script, or one of them in a wrapper of brumate/events',
        call,
      );
      return;
    }
    for (const name of freeNames(fn)) {
      if (isLocal(name)) {
        this.report(
          'error',
          `The handler reads "${name}", a value of the function around $handler, which the browser does not have. Pass it as an argument: $handler(fn, ${name})`,
          fn,
        );
        return;
      }
    }
    if (call.arguments.slice(1).some((argument) => argument.type === 'SpreadElement')) {
      this.report('error', 'The arguments of $handler cannot be spread', call);
    }
    this.createSite('prop', scope, fn, 'handler', {
      handler: call,
      modifiers: this.handlerModifiers(fn, scope),
    });
  }

  /**
   * The modifiers of the wrappers around the function of `$handler`, such as
   * `prevent`, as `b-on` holds them. Markup that the browser renders writes
   * them without loading the code of the handler.
   */
  private handlerModifiers(node: oxc.Node, scope: Scope): string[] | undefined {
    const modifiers: string[] = [];
    while (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
      const imported = lookup(scope, node.callee.name)?.imported;
      const name = imported?.source === EVENTS_MODULE ? imported.name : undefined;
      const [handler, ...keys] = node.arguments;
      if (name === undefined || !WRAPPERS.has(name) || !handler) {
        break;
      }
      const names = keys.map((key) =>
        key.type === 'Literal' && typeof key.value === 'string' ? key.value : undefined,
      );
      if (names.some((key) => key === undefined)) {
        this.report('error', "Name each key of prevent as a string, such as 'Enter'", node);
      }
      modifiers.push(names.length > 0 ? `${name}(${names.join(',')})` : name);
      node = handler;
    }
    return modifiers.length > 0 ? modifiers : undefined;
  }

  /** A function, a function of the script, or one of them in wrappers of `brumate/events`. */
  private isHandlerFunction(node: oxc.Node, scope: Scope): boolean {
    while (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      lookup(scope, node.callee.name)?.imported?.source === EVENTS_MODULE &&
      node.arguments[0]
    ) {
      node = node.arguments[0];
    }
    if (isFunction(node)) {
      return true;
    }
    if (node.type === 'Identifier') {
      const kind = lookup(scope, node.name)?.kind;
      return kind === 'function' || kind === 'server-function';
    }
    return false;
  }

  private declareProvide(call: oxc.CallExpression, scope: Scope): void {
    const [context, value] = call.arguments;
    if (!context || !value || call.arguments.length !== 2) {
      this.report('error', '$setContext takes two arguments, the context and the value', call);
      return;
    }
    this.createSite('provide', scope, value, 'provide', { extra: [context] });
  }

  private declareEffect(call: oxc.CallExpression, name: '$effect' | '$client', scope: Scope): void {
    const callback = call.arguments[0];
    if (!isFunction(callback)) {
      this.report('error', `${name} needs a function`, call);
      return;
    }
    if (callback.params.length > 0) {
      this.report('error', `The callback of ${name} takes no parameters`, callback);
    }
    if (callback.async) {
      this.report('error', `The callback of ${name} cannot be async`, callback);
    }
    if (name === '$effect') {
      if (call.arguments.length > 1) {
        this.report('error', '$effect takes one argument', call);
      }
      this.createSite('effect', scope, callback, 'effect');
      return;
    }
    let trigger: Site['trigger'] = 'visible';
    const argument = call.arguments[1];
    if (argument) {
      if (
        argument.type !== 'Literal' ||
        typeof argument.value !== 'string' ||
        !CLIENT_TRIGGERS.has(argument.value)
      ) {
        this.report(
          'error',
          'The trigger of $client must be "visible", "idle" or "load"',
          argument,
        );
      } else {
        trigger = argument.value as Site['trigger'];
      }
    }
    if (trigger === 'load') {
      this.report('warning', '$client with "load" runs before any interaction', call);
    }
    this.createSite('client', scope, callback, `client ${trigger}`, { trigger });
  }

  private declareTemplate(template: TemplateDecl, scope: Scope): void {
    this.addDeclaration(scope, template.name, 'template', template.nameRange);
    const templateScope = this.createScope('template', scope, { template, body: template.body });
    for (const param of template.params) {
      for (const binding of getPatternNames(param)) {
        this.addDeclaration(templateScope, binding.name, 'template-param', binding);
      }
      this.createDefaultSites(param, templateScope);
    }
    this.visitBodyContent(template.body, templateScope);
  }

  // Markup

  private visitBody(
    body: Body,
    parent: Scope,
    block: Block,
    declare?: (scope: Scope) => void,
  ): void {
    const scope = this.createScope('body', parent, { block, body });
    declare?.(scope);
    this.visitBodyContent(body, scope);
  }

  private visitBodyContent(body: Body, scope: Scope): void {
    if (body.script) {
      this.declareScript(body.script.program, scope, false);
    }
    for (const template of body.templates) {
      this.declareTemplate(template, scope);
    }
    this.visitNodes(body.children, scope);
  }

  private visitNodes(nodes: Markup[], scope: Scope): void {
    for (const node of nodes) {
      this.visitNode(node, scope);
    }
  }

  private visitNode(node: Markup, scope: Scope): void {
    switch (node.kind) {
      case 'text':
        break;
      case 'insert':
        this.createExpressionSite('insert', scope, node.expression, 'insert');
        break;
      case 'element':
      case 'dynamic':
        if (node.kind === 'dynamic') {
          this.createExpressionSite('tag', scope, node.tag, 'tag', { owner: node });
        }
        this.visitAttributes(node, scope);
        this.visitNodes(node.children, scope);
        break;
      case 'component':
        this.visitAttributes(node, scope);
        this.visitNodes(node.children, scope);
        break;
      case 'fragment':
        this.visitNodes(node.children, scope);
        break;
      case 'listener':
        for (const attribute of node.attributes) {
          const site = this.createExpressionSite(
            'event',
            scope,
            attribute.handler,
            `event ${node.target}.${attribute.event}`,
            {
              owner: node,
              event: attribute,
            },
          );
          this.readWrappers(site, attribute, scope);
        }
        break;
      default:
        this.visitBlock(node, scope);
        break;
    }
  }

  private visitAttributes(node: ElementNode | ComponentNode | DynamicTagNode, scope: Scope): void {
    const isComponent = node.kind === 'component';
    let tag = 'dynamic';
    if (node.kind === 'element') {
      tag = node.tag;
    } else if (node.kind === 'component') {
      tag = node.name;
    }
    for (const attribute of node.attributes) {
      if (
        !isComponent &&
        (attribute.kind === 'static' || attribute.kind === 'value') &&
        attribute.name.startsWith('b-')
      ) {
        this.report(
          'error',
          `"${attribute.name}" is reserved. Brumate writes the attributes that start with "b-"`,
          attribute,
        );
      }
      switch (attribute.kind) {
        case 'static':
        case 'prefetch':
          break;
        case 'value':
          this.createExpressionSite(
            isComponent ? 'prop' : 'attribute',
            scope,
            attribute.value,
            `${isComponent ? 'prop' : 'attribute'} ${tag}.${attribute.name}`,
            { owner: node },
          );
          break;
        case 'event': {
          const site = this.createExpressionSite(
            isComponent ? 'prop' : 'event',
            scope,
            attribute.handler,
            isComponent ? `prop ${tag}.${attribute.name}` : `event ${tag}.${attribute.event}`,
            { owner: node, event: isComponent ? undefined : attribute },
          );
          if (!isComponent) {
            this.readWrappers(site, attribute, scope);
          }
          break;
        }
        case 'ref':
          if (node.kind === 'element') {
            this.refs.push({ attribute, element: node, scope });
          }
          break;
        case 'spread':
          this.createExpressionSite('spread', scope, attribute.value, `spread ${tag}`, {
            owner: node,
          });
          break;
        case 'computed':
          this.createExpressionSite(
            isComponent ? 'prop' : 'attribute',
            scope,
            attribute.name,
            `computed ${tag}`,
            {
              owner: node,
            },
          );
          if (attribute.value !== true) {
            this.createExpressionSite(
              isComponent ? 'prop' : 'attribute',
              scope,
              attribute.value,
              `computed ${tag}`,
              {
                owner: node,
              },
            );
          }
          break;
      }
    }
  }

  private header(block: Block, scope: Scope, expression: Expression, label: string): void {
    this.createExpressionSite('block', scope, expression, label, { block });
  }

  private visitBlock(block: Block, scope: Scope): void {
    switch (block.kind) {
      case 'if':
        for (const branch of block.branches) {
          this.header(block, scope, branch.condition, 'if');
          this.visitBody(branch.body, scope, block);
        }
        if (block.fallback) {
          this.visitBody(block.fallback, scope, block);
        }
        break;
      case 'for':
        this.header(block, scope, block.list, 'for');
        if (block.key && block.key !== 'index') {
          // The key reads the item, so it resolves in the body scope.
          const key = block.key;
          this.visitBody(block.body, scope, block, (body) => {
            this.declareLoopVariables(block, body);
            this.createExpressionSite('block', body, key, 'for key', { block });
          });
        } else {
          this.visitBody(block.body, scope, block, (body) =>
            this.declareLoopVariables(block, body),
          );
        }
        if (block.fallback) {
          this.visitBody(block.fallback, scope, block);
        }
        break;
      case 'repeat':
        this.header(block, scope, block.count, 'repeat');
        this.visitBody(block.body, scope, block, (body) => {
          if (block.index) {
            this.addDeclaration(body, block.index.name, 'index', block.index, block);
          }
        });
        if (block.fallback) {
          this.visitBody(block.fallback, scope, block);
        }
        break;
      case 'switch':
        for (const branch of block.cases) {
          this.header(block, scope, branch.condition, 'case');
          this.visitBody(branch.body, scope, block);
        }
        if (block.fallback) {
          this.visitBody(block.fallback, scope, block);
        }
        break;
      case 'key':
        this.header(block, scope, block.value, 'key');
        this.visitBody(block.body, scope, block);
        break;
      case 'try':
        this.visitBody(block.body, scope, block);
        this.visitBody(block.fallback, scope, block, (body) => {
          if (block.error) {
            this.addDeclaration(body, block.error.name, 'error', block.error, block);
          }
          if (block.reset) {
            this.addDeclaration(body, block.reset.name, 'reset', block.reset, block);
          }
        });
        break;
      case 'loading':
        if (block.on) {
          this.header(block, scope, block.on, 'loading');
        }
        this.visitBody(block.body, scope, block);
        if (block.fallback) {
          this.visitBody(block.fallback, scope, block);
        }
        break;
      case 'head':
        this.visitBody(block.body, scope, block);
        break;
      case 'portal':
        if (block.target) {
          this.header(block, scope, block.target, 'portal');
        }
        this.visitBody(block.body, scope, block);
        break;
      case 'client':
      case 'defer':
        this.visitBody(block.body, scope, block);
        if (block.fallback) {
          this.visitBody(block.fallback, scope, block);
        }
        break;
      case 'offscreen':
        this.header(block, scope, block.visible, 'offscreen');
        this.visitBody(block.body, scope, block);
        break;
    }
  }

  private declareLoopVariables(block: Block & { kind: 'for' }, body: Scope): void {
    for (const binding of getPatternNames(block.item)) {
      this.addDeclaration(body, binding.name, 'item', binding, block);
    }
    this.createDefaultSites(block.item, body);
    if (block.index) {
      this.addDeclaration(body, block.index.name, 'index', block.index, block);
    }
  }

  // Checks

  private resolveRefs(): void {
    for (const ref of this.refs) {
      const declaration = lookup(ref.scope, ref.attribute.target);
      if (!declaration) {
        this.report(
          'error',
          `"${ref.attribute.target}" is not declared`,
          ref.attribute.targetRange,
        );
      } else if (declaration.kind !== 'signal') {
        this.report(
          'error',
          `ref must name a $signal, but "${declaration.name}" is a ${declaration.kind}`,
          ref.attribute,
        );
      } else {
        declaration.refs.push(ref);
      }
    }
  }

  private check(): void {
    for (const declaration of this.declarations) {
      if (declaration.kind === 'action') {
        const target = lookup(declaration.scope, declaration.action!);
        if (target?.kind !== 'server-function') {
          this.report(
            'error',
            `$action needs a server function of this file, and ${declaration.action} is not one`,
            declaration.range,
          );
        }
      }
    }
    for (const site of this.sites) {
      for (const write of site.writes) {
        const declaration = write.declaration;
        if (!WRITABLE.has(declaration.kind) && !declaration.writable) {
          this.report(
            'error',
            `Cannot assign to ${declaration.kind} "${declaration.name}"`,
            write.range,
          );
        } else if (
          (declaration.kind === 'signal' || declaration.writable) &&
          !write.inFunction &&
          !WRITING_SITES.has(site.kind)
        ) {
          this.report(
            'error',
            `Signal "${declaration.name}" can only be written in event handlers, effects, $client callbacks and functions`,
            write.range,
          );
        }
      }
      if (site.kind === 'server-function') {
        for (const read of site.reads) {
          if (!SERVER_CAPTURABLE.has(read.declaration.kind)) {
            this.report(
              'error',
              `Server function "${site.declaration?.name}" captures "${read.declaration.name}". Pass it as an argument`,
              read.range,
            );
          }
        }
      }
      if (site.kind === 'memo' && site.declaration?.writable) {
        this.linkOptimistic(site.declaration);
      }
      if (site.kind === 'memo' && site.declaration) {
        const callsServer = [...site.calls].some(
          (declaration) => declaration.kind === 'server-function',
        );
        if (callsServer || site.awaits) {
          site.declaration.kind = 'async-memo';
        }
      }
    }
  }

  /**
   * Finds the source of `$optimistic(source)`. A write reads the source too,
   * so the source has a slot that the browser can reset the guess from.
   */
  private linkOptimistic(declaration: Declaration): void {
    const site = declaration.site!;
    const source = site.reads.find((read) => read.range.start === site.range.start)?.declaration;
    if (!source) {
      return;
    }
    declaration.optimistic = source;
    if (source.kind === 'signal' || source.kind === 'let') {
      // A value that handlers write can be written directly, without a guess.
      this.report(
        'error',
        '$optimistic follows a memo, an action or a prop, not a signal',
        site.range,
      );
    }
    for (const write of declaration.writes) {
      const read = { ...write, declaration: source, range: source.range };
      source.reads.push(read);
      write.site.reads.push(read);
    }
  }
}

/** Resolves the identifiers of one site to declarations. */
class Resolver {
  private readonly analyzer: Analyzer;
  private readonly site: Site;
  private readonly locals: Set<string>[] = [];
  private functionDepth = 0;
  private untracked = 0;

  constructor(analyzer: Analyzer, site: Site) {
    this.analyzer = analyzer;
    this.site = site;
  }

  run(): void {
    const node = this.site.node;
    if (
      isFunction(node) &&
      (this.site.kind === 'function' || this.site.kind === 'server-function')
    ) {
      // The function itself is the site, so its body is not an inner function.
      this.visitFunction(node, true);
    } else if (isFunction(node) && (this.site.kind === 'effect' || this.site.kind === 'client')) {
      this.visitFunction(node, true);
    } else {
      this.visit(node);
    }
    for (const extra of this.site.extra ?? []) {
      this.visit(extra);
    }
  }

  private isLocal(name: string): boolean {
    return this.locals.some((scope) => scope.has(name));
  }

  private withLocals(names: Iterable<string>, callback: () => void): void {
    this.locals.push(new Set(names));
    callback();
    this.locals.pop();
  }

  private reference(
    identifier: oxc.Node & { name: string },
    mode: 'read' | 'write' | 'update',
  ): Reference | undefined {
    if (this.isLocal(identifier.name)) {
      return undefined;
    }
    const declaration = lookup(this.site.scope, identifier.name);
    if (!declaration) {
      return undefined;
    }
    const reference: Reference = {
      range: range(identifier),
      declaration,
      site: this.site,
      tracked: this.untracked === 0,
      inFunction: this.functionDepth > 0,
    };
    if (mode !== 'write') {
      declaration.reads.push(reference);
      this.site.reads.push(reference);
    }
    if (mode !== 'read') {
      declaration.writes.push(reference);
      this.site.writes.push(reference);
    }
    if (
      declaration.kind === 'function' ||
      declaration.kind === 'server-function' ||
      declaration.kind === 'template'
    ) {
      this.site.calls.add(declaration);
      if (this.untracked === 0) {
        this.site.trackedCalls.add(declaration);
      }
    }
    return reference;
  }

  /**
   * `$bind(name)` passes a child a reference to a signal, or to a prop that
   * the component writes, so the child's writes reach it. It is the whole
   * value of a prop of a component. The name gets a slot, which the
   * reference points to.
   */
  private declareBinding(call: oxc.CallExpression): void {
    let node: oxc.Node = this.site.node;
    while (node.type === 'ParenthesizedExpression') {
      node = node.expression;
    }
    const owner = this.site.owner;
    // On an element, it is the value of an input, a select or a text area, or whether a box is checked.
    const element =
      this.site.kind === 'attribute' && owner?.kind === 'element'
        ? owner.attributes.find(
            (attribute) => attribute.kind === 'value' && attribute.value.ast === this.site.node,
          )
        : undefined;
    const onElement =
      element?.kind === 'value' &&
      (element.name === 'value' || element.name === 'checked') &&
      ['input', 'select', 'textarea'].includes((owner as { tag: string }).tag.toLowerCase());
    if (!(this.site.kind === 'prop' || onElement) || node !== call) {
      this.analyzer.report(
        'error',
        'Pass $bind(name) as the value of a prop of a component, or of value or checked of an input, a select or a textarea',
        call,
      );
      return;
    }
    const [target, ...rest] = call.arguments;
    if (!target || target.type !== 'Identifier' || rest.length > 0) {
      this.analyzer.report('error', '$bind takes the name of a signal, such as $bind(open)', call);
      return;
    }
    const declaration = this.isLocal(target.name)
      ? undefined
      : lookup(this.site.scope, target.name);
    if (
      !declaration ||
      !(declaration.kind === 'signal' || (declaration.kind === 'prop' && declaration.writable))
    ) {
      this.analyzer.report(
        'error',
        `$bind takes a signal, or a prop that the component destructures with let, and "${target.name}" is not one`,
        target,
      );
      return;
    }
    declaration.bound = true;
    this.analyzer.bindings.push({ call, declaration });
  }

  private visitChildren(node: oxc.Node): void {
    for (const [key, child] of children(node)) {
      if (!TYPE_KEYS.has(key)) {
        this.visit(child);
      }
    }
  }

  private visitStatements(statements: oxc.Node[]): void {
    this.withLocals(lexicalNames(statements), () => {
      for (const statement of statements) {
        this.visit(statement);
      }
    });
  }

  private visit(node: oxc.Node): void {
    switch (node.type) {
      case 'Identifier':
        this.reference(node, 'read');
        return;
      case 'MemberExpression':
        this.visit(node.object);
        if (node.computed) {
          this.visit(node.property);
        }
        return;
      case 'Property':
      case 'MethodDefinition':
      case 'PropertyDefinition':
      case 'AccessorProperty':
        if (node.computed) {
          this.visit(node.key);
        }
        if (node.value) {
          this.visit(node.value);
        }
        return;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        this.visitFunction(node, false);
        return;
      case 'ClassDeclaration':
      case 'ClassExpression':
        this.withLocals(node.type === 'ClassExpression' && node.id ? [node.id.name] : [], () => {
          if (node.superClass) {
            this.visit(node.superClass);
          }
          this.visit(node.body);
        });
        return;
      case 'BlockStatement':
      case 'StaticBlock':
        this.visitStatements(node.body);
        return;
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement': {
        const declaration = node.type === 'ForStatement' ? node.init : node.left;
        const names =
          declaration?.type === 'VariableDeclaration'
            ? declaration.declarations.flatMap((item) =>
                getPatternNames(item.id).map((name) => name.name),
              )
            : [];
        this.withLocals(names, () => {
          if (node.type === 'ForStatement') {
            this.visitChildren(node);
          } else {
            if (node.left.type === 'VariableDeclaration') {
              this.visit(node.left);
            } else {
              this.visitTarget(node.left, 'write');
            }
            this.visit(node.right);
            this.visit(node.body);
          }
        });
        return;
      }
      case 'SwitchStatement':
        this.visit(node.discriminant);
        this.withLocals(lexicalNames(node.cases.flatMap((item) => item.consequent)), () => {
          for (const item of node.cases) {
            if (item.test) {
              this.visit(item.test);
            }
            for (const statement of item.consequent) {
              this.visit(statement);
            }
          }
        });
        return;
      case 'CatchClause':
        this.withLocals(
          node.param ? getPatternNames(node.param).map((name) => name.name) : [],
          () => {
            if (node.param) {
              this.visitDefaults(node.param);
            }
            this.visit(node.body);
          },
        );
        return;
      case 'VariableDeclaration':
        for (const declarator of node.declarations) {
          this.visitDefaults(declarator.id);
          if (declarator.init) {
            this.visit(declarator.init);
          }
        }
        return;
      case 'AssignmentExpression':
        this.checkMutation(node.left, node);
        this.visitTarget(node.left, node.operator === '=' ? 'write' : 'update');
        this.visit(node.right);
        return;
      case 'UpdateExpression':
        this.checkMutation(node.argument, node);
        if (node.argument.type === 'Identifier') {
          this.reference(node.argument, 'update');
        } else {
          this.visit(node.argument);
        }
        return;
      case 'LabeledStatement':
        this.visit(node.body);
        return;
      case 'BreakStatement':
      case 'ContinueStatement':
      case 'MetaProperty':
        return;
      case 'AwaitExpression': {
        // `await name` of a memo waits for its value in the render around the read, and is a
        // plain read of the value in the browser. Every other await waits for a promise.
        const argument = node.argument;
        if (argument.type === 'Identifier') {
          const declaration = this.isLocal(argument.name)
            ? undefined
            : lookup(this.site.scope, argument.name);
          if (declaration?.kind === 'memo' || declaration?.kind === 'async-memo') {
            const reference = this.reference(argument, 'read');
            if (reference) {
              reference.await = range(node);
            }
            return;
          }
        }
        if (this.functionDepth === 0) {
          this.site.awaits = true;
        }
        this.visit(argument);
        return;
      }
      case 'CallExpression': {
        // `event.refresh(fn)` in a server function: memos that call `fn` load again.
        if (
          this.site.kind === 'server-function' &&
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'refresh' &&
          node.arguments[0]?.type === 'Identifier'
        ) {
          const target = lookup(this.site.scope, node.arguments[0].name);
          if (target?.kind === 'server-function') {
            target.refreshed = true;
          }
        }
        if (
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.property.type === 'Identifier' &&
          MUTATORS.has(node.callee.property.name)
        ) {
          this.checkMutation(node.callee.object, node);
        }
        const name = node.callee.type === 'Identifier' ? node.callee.name : undefined;
        if (name && !this.isLocal(name) && !lookup(this.site.scope, name)) {
          if (name === '$untrack') {
            this.untracked++;
            for (const argument of node.arguments) {
              this.visit(argument);
            }
            this.untracked--;
            return;
          }
          if (name === '$isPending') {
            const [target] = node.arguments;
            if (target?.type !== 'Identifier' || node.arguments.length !== 1) {
              this.analyzer.report(
                'error',
                '$isPending needs an async $memo as its only argument',
                node,
              );
            }
            this.visitChildren(node);
            const reference = this.site.reads.at(-1);
            if (target?.type === 'Identifier' && reference?.range.start === target.start) {
              this.analyzer.pendingCalls.push({ reference, at: range(node) });
            }
            return;
          }
          if (name === '$produce') {
            // `$produce(todos, recipe)` reads and writes `todos`.
            const [target, recipe, ...rest] = node.arguments;
            if (target?.type === 'Identifier') {
              this.reference(target, 'update');
            } else {
              this.analyzer.report('error', '$produce needs a signal as its first argument', node);
            }
            if (!isFunction(recipe)) {
              this.analyzer.report(
                'error',
                '$produce needs a recipe function as its second argument',
                node,
              );
            }
            for (const argument of recipe ? [recipe, ...rest] : rest) {
              this.visit(argument);
            }
            return;
          }
          if (name === '$bind') {
            this.declareBinding(node);
            for (const argument of node.arguments) {
              this.visit(argument);
            }
            return;
          }
          if (name === '$handler') {
            this.analyzer.declareHandler(node, this.site.scope, (local) => this.isLocal(local));
            // The arguments are values of this site, which go with the handler.
            for (const argument of node.arguments.slice(1)) {
              this.visit(argument);
            }
            return;
          }
          if (COMPILE_TIME_FUNCTIONS.has(name)) {
            this.analyzer.report('error', MISPLACED[name] ?? `${name} cannot be used here`, node);
          } else if (name in REMOVED) {
            this.analyzer.report('error', REMOVED[name]!, node);
          }
        }
        this.visitChildren(node);
        return;
      }
      default:
        if (TYPE_WRAPPERS.has(node.type)) {
          this.visit((node as { expression: oxc.Node }).expression);
        } else if (!node.type.startsWith('TS')) {
          this.visitChildren(node);
        }
    }
  }

  private visitFunction(fn: Fn, isSite: boolean): void {
    if (!isSite && hasUseServer(fn)) {
      this.analyzer.report('error', 'Declare server functions at the top level of a script', fn);
    }
    const names = fn.params.flatMap((param) => getPatternNames(param).map((name) => name.name));
    if (fn.type === 'FunctionExpression' && fn.id) {
      names.push(fn.id.name);
    }
    const body = fn.body;
    if (body?.type === 'BlockStatement') {
      names.push(...lexicalNames(body.body), ...varNames(body));
    }
    if (!isSite) {
      this.functionDepth++;
    }
    this.withLocals(names, () => {
      for (const param of fn.params) {
        this.visitDefaults(param);
      }
      if (body?.type === 'BlockStatement') {
        for (const statement of body.body) {
          this.visit(statement);
        }
      } else if (body) {
        this.visit(body);
      }
    });
    if (!isSite) {
      this.functionDepth--;
    }
  }

  /** Visits the default values and computed keys of a binding pattern. */
  private visitDefaults(pattern: oxc.Node): void {
    switch (pattern.type) {
      case 'AssignmentPattern':
        this.visitDefaults(pattern.left);
        this.visit(pattern.right);
        break;
      case 'ObjectPattern':
        for (const property of pattern.properties) {
          if (property.type === 'RestElement') {
            this.visitDefaults(property.argument);
          } else {
            if (property.computed) {
              this.visit(property.key);
            }
            this.visitDefaults(property.value);
          }
        }
        break;
      case 'ArrayPattern':
        for (const element of pattern.elements) {
          if (element) {
            this.visitDefaults(element);
          }
        }
        break;
      case 'RestElement':
        this.visitDefaults(pattern.argument);
        break;
      case 'TSParameterProperty':
        this.visitDefaults(pattern.parameter);
        break;
      default:
        break;
    }
  }

  /** Visits the target of an assignment. */
  /**
   * Warns when code changes a reactive value in place, such as
   * `todos.push(todo)` or `todo.done = true`. The value does not change, so
   * nothing that reads it updates.
   */
  private checkMutation(target: oxc.Node, at: oxc.Node): void {
    // Writing a variable itself is how values change. Only writes into the value are in place.
    if (at.type !== 'CallExpression' && target.type !== 'MemberExpression') {
      return;
    }
    let object = target;
    while (object.type === 'MemberExpression') {
      object = object.object;
    }
    if (object.type !== 'Identifier' || this.isLocal(object.name)) {
      return;
    }
    const declaration = lookup(this.site.scope, object.name);
    if (!declaration || !REACTIVE.has(declaration.kind)) {
      return;
    }
    this.analyzer.report(
      'warning',
      `This changes the value of ${object.name} in place, so nothing that reads it updates. Write a new value, such as with $produce(${object.name}, (draft) => { … })`,
      at,
    );
  }

  private visitTarget(target: oxc.Node, mode: 'write' | 'update'): void {
    switch (target.type) {
      case 'Identifier':
        this.reference(target, mode);
        break;
      case 'ObjectPattern':
        for (const property of target.properties) {
          if (property.type === 'RestElement') {
            this.visitTarget(property.argument, 'write');
          } else {
            if (property.computed) {
              this.visit(property.key);
            }
            this.visitTarget(property.value, 'write');
          }
        }
        break;
      case 'ArrayPattern':
        for (const element of target.elements) {
          if (element) {
            this.visitTarget(element, 'write');
          }
        }
        break;
      case 'AssignmentPattern':
        this.visitTarget(target.left, 'write');
        this.visit(target.right);
        break;
      case 'RestElement':
        this.visitTarget(target.argument, 'write');
        break;
      default:
        if (TYPE_WRAPPERS.has(target.type)) {
          this.visitTarget((target as { expression: oxc.Node }).expression, mode);
        } else {
          this.visit(target);
        }
    }
  }
}

/** Returns the names that statements declare in their own block. */
function lexicalNames(statements: oxc.Node[]): string[] {
  const names: string[] = [];
  for (const statement of statements) {
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        names.push(...getPatternNames(declarator.id).map((name) => name.name));
      }
    } else if (
      (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
      statement.id
    ) {
      names.push(statement.id.name);
    }
  }
  return names;
}

/** Returns the names of `var` declarations in a function body, outside nested functions. */
function varNames(node: oxc.Node, names: string[] = []): string[] {
  for (const [, child] of children(node)) {
    if (isFunction(child)) {
      continue;
    }
    if (child.type === 'VariableDeclaration' && child.kind === 'var') {
      for (const declarator of child.declarations) {
        names.push(...getPatternNames(declarator.id).map((name) => name.name));
      }
    }
    varNames(child, names);
  }
  return names;
}

/**
 * The names that code reads and does not declare itself, such as what a
 * function reads from around it. Property names are not reads.
 */
function freeNames(node: oxc.Node): Set<string> {
  const free = new Set<string>();
  const visit = (current: oxc.Node, bound: Set<string>): void => {
    if (isFunction(current)) {
      const inner = new Set(bound);
      for (const param of current.params) {
        for (const name of getPatternNames(param)) {
          inner.add(name.name);
        }
      }
      if (current.type === 'FunctionExpression' && current.id) {
        inner.add(current.id.name);
      }
      const body = current.body;
      if (body?.type === 'BlockStatement') {
        for (const name of [...lexicalNames(body.body), ...varNames(body)]) {
          inner.add(name);
        }
      }
      for (const param of current.params) {
        visit(param, inner);
      }
      if (body) {
        visit(body, inner);
      }
      return;
    }
    if (current.type === 'Identifier') {
      if (!bound.has(current.name)) {
        free.add(current.name);
      }
      return;
    }
    if (current.type === 'MemberExpression' && !current.computed) {
      visit(current.object, bound);
      return;
    }
    if (current.type === 'Property' && !current.computed) {
      visit(current.value, bound);
      return;
    }
    for (const [, child] of children(current)) {
      visit(child, bound);
    }
  };
  visit(node, new Set());
  return free;
}
