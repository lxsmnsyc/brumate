import type { Block, Range, SFCFile } from '../ast.ts';
import { isWithin, lookup, upstreamMemos } from '../model.ts';
import type { Declaration, Diagnostic, Reference, Scope, SemanticModel, Site } from '../model.ts';
import { children } from '../oxc.ts';
import type { oxc } from '../oxc.ts';
import { holderArguments } from '../plan.ts';
import type { Plan } from '../plan.ts';
import type { SharedContext } from '../shared-module.ts';
import { Patch } from './patch.ts';
import { instanceScope, scopePath, slotIndex } from './scopes.ts';

const COMPOUND: Record<string, string> = {
  '+=': '+',
  '-=': '-',
  '*=': '*',
  '/=': '/',
  '%=': '%',
  '**=': '**',
  '<<=': '<<',
  '>>=': '>>',
  '>>>=': '>>>',
  '&=': '&',
  '|=': '|',
  '^=': '^',
  '&&=': '&&',
  '||=': '||',
  '??=': '??',
};

export interface RewriteOptions {
  /** Declarations that are plain variables in the output, such as the item of a key function. */
  locals?: Set<Declaration>;
  /** The range to return. Defaults to the site's node. */
  range?: Range;
  /** Adds more edits, such as renaming a function. */
  edit?: (patch: Patch) => void;
}

/** Rewrites the code of client sites to read and write slots of scope instances. */
export class Rewriter {
  private readonly file: SFCFile;
  private readonly plan: Plan;
  private readonly diagnostics: Diagnostic[];

  private readonly shared: SharedContext | undefined;

  /** The sites of `$handler` calls, by call. */
  private readonly handlers = new Map<oxc.Node, Site>();
  /** The declarations of the names of `$bind` calls, by call. */
  private readonly bindings = new Map<oxc.Node, SemanticModel['bindings'][number]>();

  constructor(file: SFCFile, plan: Plan, diagnostics: Diagnostic[], shared?: SharedContext) {
    this.file = file;
    this.plan = plan;
    this.diagnostics = diagnostics;
    this.shared = shared;
    for (const site of plan.graph.model.sites) {
      if (site.handler) {
        this.handlers.set(site.handler, site);
      }
    }
    for (const binding of plan.graph.model.bindings) {
      this.bindings.set(binding.call, binding);
    }
  }

  /**
   * The call of the shared code of a site that a module function gave the
   * component: the function to call, and the cells of its names in this
   * call. Undefined when the site is the component's own code, or when a
   * name it reads has no value in the browser.
   */
  sharedCall(
    site: Site,
    scopeVar: string,
    base: Scope,
  ): { fn: string; refs: string; kind: 'function' | 'expression' } | undefined {
    const found = this.shared?.find(site.node);
    if (!found) {
      return undefined;
    }
    // A ref for each name: a slot of this scope, `[scope, slot]`, or `[value]`. See `cells`.
    const refs: string[] = [];
    for (const name of found.site.names) {
      const value = found.names.get(name);
      if (!value) {
        return undefined;
      }
      if ('literal' in value) {
        refs.push(`[${value.literal}]`);
        continue;
      }
      const declaration = lookup(site.scope, value.name);
      if (!declaration) {
        return undefined;
      }
      const slot = slotIndex(this.plan, declaration);
      if (slot !== -1) {
        const path = scopePath(this.plan, scopeVar, base, declaration.scope);
        refs.push(path === scopeVar ? String(slot) : `[${path}, ${slot}]`);
        continue;
      }
      const read = this.value(declaration, scopeVar, base);
      if (!read) {
        return undefined;
      }
      refs.push(`[${read}]`);
    }
    return {
      fn: `$$m${found.module}.${found.site.name}`,
      refs: `[${refs.join(', ')}]`,
      kind: found.site.kind,
    };
  }

  /**
   * Returns an expression for a declaration, read from code whose scope
   * instance is `scopeVar`, the instance of `base`.
   */
  value(declaration: Declaration, scopeVar: string, base: Scope): string | undefined {
    const slot = slotIndex(this.plan, declaration);
    if (slot !== -1) {
      return `$$b.get(${scopePath(this.plan, scopeVar, base, declaration.scope)}, ${slot})`;
    }
    switch (declaration.kind) {
      case 'function': {
        const owner = instanceScope(this.plan, declaration.scope);
        return `${declaration.name}$.bind(null, ${scopePath(this.plan, scopeVar, base, owner)})`;
      }
      case 'server-function':
        return `${declaration.name}$`;
      case 'reset': {
        // Renders the `#try` body again, in the range of the block.
        const block = declaration.block as Block & { kind: 'try' };
        const owner = declaration.scope.parent!;
        const body = this.plan.bodyScopes.get(block.body)!;
        const fallback = this.plan.bodyScopes.get(block.fallback)!;
        const kinds: number[] = [];
        for (const scope of this.plan.graph.model.scopes) {
          if (isWithin(scope, body) || isWithin(scope, fallback)) {
            kinds.push(scope.id);
          }
        }
        const args = [
          scopePath(this.plan, scopeVar, base, owner),
          this.plan.anchors.get(block),
          JSON.stringify(this.plan.id),
          JSON.stringify(`r${body.id}`),
          JSON.stringify(`r${fallback.id}`),
          `[${kinds.join(', ')}]`,
        ];
        const held = holderArguments(this.plan, block);
        if (held) {
          args.push(held.slice(2));
        }
        return `$$b.reset.bind(null, ${args.join(', ')})`;
      }
      default:
        return undefined;
    }
  }

  /** `$produce(todos, recipe)` writes the slot of `todos` with the result of the recipe. */
  private rewriteProduce(
    node: oxc.CallExpression,
    target: oxc.IdentifierReference,
    patch: Patch,
    references: Map<number, Reference>,
    locals: Set<Declaration>,
    scopeVar: string,
    base: Scope,
    visit: (node: oxc.Node) => void,
  ): void {
    const reference = references.get(target.start);
    const declaration = reference?.declaration;
    const slot = declaration && !locals.has(declaration) ? slotIndex(this.plan, declaration) : -1;
    if (declaration && slot !== -1) {
      const path = scopePath(this.plan, scopeVar, base, declaration.scope);
      patch.replace(
        node.start,
        target.end,
        `$$b.set(${path}, ${slot}, $$b.produce($$b.get(${path}, ${slot})`,
      );
    } else if (declaration && !locals.has(declaration)) {
      // Nothing on the client reads the value, so there is nothing to change.
      patch.replace(node.start, node.end, 'undefined');
      return;
    } else {
      patch.replace(node.start, target.end, `(${target.name} = $$b.produce(${target.name}`);
    }
    patch.insert(node.end, ')');
    for (const argument of node.arguments.slice(1)) {
      visit(argument);
    }
  }

  rewrite(site: Site, scopeVar: string, base: Scope, options: RewriteOptions = {}): string {
    // Code that a module function gave the component calls the shared module instead.
    if (!options.range && !options.edit && !options.locals) {
      const shared = this.sharedCall(site, scopeVar, base);
      if (shared) {
        return shared.kind === 'function'
          ? `((...$$a) => ${shared.fn}(${scopeVar}, ${shared.refs}, ...$$a))`
          : `${shared.fn}(${scopeVar}, ${shared.refs})`;
      }
    }
    const patch = this.edits(site, scopeVar, base, options);
    const range = options.range ?? site.node;
    return patch.slice(range.start, range.end);
  }

  /**
   * Rewrites the code of a site, and passes `read` a function that returns
   * the rewritten code of a range in it. Returns undefined for a site that
   * calls the shared module, because its code is not in the component.
   */
  rewriteRanges<T>(
    site: Site,
    scopeVar: string,
    base: Scope,
    read: (slice: (start: number, end: number) => string) => T,
  ): T | undefined {
    if (this.sharedCall(site, scopeVar, base)) {
      return undefined;
    }
    const patch = this.edits(site, scopeVar, base, {});
    return read((start, end) => patch.slice(start, end));
  }

  /** The edits that rewrite the code of a site. */
  private edits(site: Site, scopeVar: string, base: Scope, options: RewriteOptions): Patch {
    const patch = new Patch(this.file.source);
    const locals = options.locals ?? new Set();
    const references = new Map<number, Reference>();
    for (const reference of [...site.reads, ...site.writes]) {
      references.set(reference.range.start, reference);
    }
    function target(node: oxc.Node): Reference | undefined {
      if (node.type !== 'Identifier') {
        return undefined;
      }
      const reference = references.get(node.start);
      return reference && !locals.has(reference.declaration) ? reference : undefined;
    }
    const path = (declaration: Declaration): string =>
      scopePath(this.plan, scopeVar, base, declaration.scope);

    const visit = (node: oxc.Node): void => {
      switch (node.type) {
        case 'Identifier': {
          const reference = target(node);
          const value = reference && this.value(reference.declaration, scopeVar, base);
          if (value) {
            patch.replace(node.start, node.end, value);
          }
          return;
        }
        case 'AwaitExpression': {
          // `await name` of a memo is a plain read of its value, which is settled in the browser.
          const reference = target(node.argument);
          if (reference?.await) {
            const value = this.value(reference.declaration, scopeVar, base);
            patch.replace(node.start, node.end, value ?? reference.declaration.name);
            return;
          }
          break;
        }
        case 'Property':
          if (node.shorthand && node.value.type === 'Identifier') {
            const reference = target(node.value);
            const value = reference && this.value(reference.declaration, scopeVar, base);
            if (value) {
              patch.replace(node.start, node.end, `${node.value.name}: ${value}`);
            }
            return;
          }
          break;
        case 'AssignmentExpression': {
          const reference = target(node.left);
          if (reference) {
            const declaration = reference.declaration;
            const slot = slotIndex(this.plan, declaration);
            if (slot === -1) {
              // Nothing on the client reads it, so only the value is kept.
              patch.replace(node.start, node.right.start, '(');
            } else if (declaration.optimistic) {
              // A guess, which goes back to the source when the server calls of the page finish.
              const source = declaration.optimistic;
              const sourceSlot = slotIndex(this.plan, source);
              const reset = sourceSlot === -1 ? '' : `, ${path(source)}, ${sourceSlot}`;
              const read = `$$b.get(${path(declaration)}, ${slot})`;
              patch.replace(
                node.start,
                node.right.start,
                node.operator === '='
                  ? `$$b.guess(${path(declaration)}, ${slot}${reset}, `
                  : `$$b.guess(${path(declaration)}, ${slot}${reset}, ${read} ${COMPOUND[node.operator]} (`,
              );
              if (node.operator !== '=') {
                patch.insert(node.end, ')');
              }
            } else if (node.operator === '=') {
              patch.replace(
                node.start,
                node.right.start,
                `$$b.set(${path(declaration)}, ${slot}, `,
              );
            } else {
              const read = `$$b.get(${path(declaration)}, ${slot})`;
              patch.replace(
                node.start,
                node.right.start,
                `$$b.set(${path(declaration)}, ${slot}, ${read} ${COMPOUND[node.operator]} (`,
              );
              patch.insert(node.end, ')');
            }
            patch.insert(node.end, ')');
            visit(node.right);
            return;
          }
          if (node.left.type === 'ObjectPattern' || node.left.type === 'ArrayPattern') {
            let writes = false;
            for (const write of site.writes) {
              if (write.range.start >= node.left.start && write.range.end <= node.left.end) {
                writes = true;
                break;
              }
            }
            if (writes) {
              this.diagnostics.push({
                severity: 'error',
                message: 'Destructuring assignment to a signal is not supported in client code yet',
                range: { start: node.start, end: node.end },
              });
            }
          }
          break;
        }
        case 'UpdateExpression': {
          const reference = target(node.argument);
          if (reference?.declaration.optimistic) {
            this.diagnostics.push({
              severity: 'error',
              message: `Assign to "${reference.declaration.name}" with = instead of ${node.operator}`,
              range: { start: node.start, end: node.end },
            });
            return;
          }
          if (reference) {
            const declaration = reference.declaration;
            const slot = slotIndex(this.plan, declaration);
            const delta = node.operator === '++' ? 1 : -1;
            patch.replace(
              node.start,
              node.end,
              slot === -1
                ? 'undefined'
                : `$$b.update(${path(declaration)}, ${slot}, ${delta}, ${node.prefix})`,
            );
            return;
          }
          break;
        }
        case 'CallExpression': {
          // `$handler(fn, ...args)` in code that the browser runs, such as a function that renders
          // the items of a list: a handler with its reference, which a spread passes on. The
          // function is the code of its own site.
          // `$bind(name)` passes a child the value of the name with its slot, which the child's
          // writes go to. The runtime's prop update takes the value.
          const bound = this.bindings.get(node);
          const [name, setterFn] = node.arguments;
          if (bound && name) {
            const { declaration, setter } = bound;
            const path = scopePath(this.plan, scopeVar, base, declaration.scope);
            const slot = slotIndex(this.plan, declaration);
            const symbol = setter && this.plan.symbols.get(setter);
            patch.replace(node.start, name.start, '$$b.binding((');
            if (setterFn && setter && symbol) {
              // The setter loads with its own part, so the binding holds its reference.
              const ref = JSON.stringify(`${this.plan.id}#${symbol}`);
              const owner = scopePath(
                this.plan,
                scopeVar,
                base,
                instanceScope(this.plan, setter.scope),
              );
              patch.replace(
                name.end,
                node.end,
                `), ${path}, ${slot}, $$b.handlerProp(() => {}, ${ref}, ${owner}))`,
              );
            } else {
              patch.replace(name.end, node.end, `), ${path}, ${slot})`);
            }
            visit(name);
            return;
          }
          const handler = this.handlers.get(node);
          if (handler) {
            const [fn, ...args] = node.arguments;
            const symbol = this.plan.symbols.get(handler);
            // The code of the handler loads with its part, so the call holds its reference, and
            // the modifiers of its wrappers, which the compiler read, in place of its function.
            const ref = JSON.stringify(`${this.plan.id}#${symbol}`);
            const owner = scopePath(
              this.plan,
              scopeVar,
              base,
              instanceScope(this.plan, handler.scope),
            );
            const modifiers = JSON.stringify(handler.modifiers ?? []);
            patch.replace(node.start, fn!.end, `$$b.handlerProp(() => {}, ${ref}, ${owner}`);
            if (args.length === 0) {
              patch.replace(fn!.end, node.end, `, [], ${modifiers})`);
            } else {
              patch.replace(fn!.end, args[0]!.start, ', [');
              patch.replace(args.at(-1)!.end, node.end, `], ${modifiers})`);
            }
            for (const argument of args) {
              visit(argument);
            }
            return;
          }
          // A call of a local function passes the scope itself. `.bind` is only for a function
          // value that escapes, such as one passed as an argument.
          const fn = target(node.callee)?.declaration;
          if (fn?.kind === 'function' && slotIndex(this.plan, fn) === -1) {
            const owner = scopePath(this.plan, scopeVar, base, instanceScope(this.plan, fn.scope));
            const open = this.file.source.indexOf('(', node.typeArguments?.end ?? node.callee.end);
            patch.replace(node.callee.start, node.callee.end, `${fn.name}$`);
            patch.insert(open + 1, node.arguments.length > 0 ? `${owner}, ` : owner);
            for (const argument of node.arguments) {
              visit(argument);
            }
            return;
          }
          if (
            node.callee.type === 'Identifier' &&
            node.callee.name === '$isBound' &&
            !references.has(node.callee.start)
          ) {
            const prop = node.arguments[0];
            const declaration = prop && references.get(prop.start)?.declaration;
            const slot = declaration ? slotIndex(this.plan, declaration) : -1;
            patch.replace(
              node.start,
              node.end,
              declaration && slot !== -1 ? `$$b.isBound(${path(declaration)}, ${slot})` : 'false',
            );
            return;
          }
          if (
            node.callee.type === 'Identifier' &&
            (node.callee.name === '$isPending' || node.callee.name === '$resolve') &&
            !references.has(node.callee.start)
          ) {
            const memo = node.arguments[0];
            const declaration = memo && references.get(memo.start)?.declaration;
            // A memo is pending while it or a memo that it reads loads.
            const checks: string[] = [];
            for (const item of declaration ? [declaration, ...upstreamMemos(declaration)] : []) {
              const slot = slotIndex(this.plan, item);
              if (slot !== -1) {
                checks.push(`$$b.pending(${path(item)}, ${slot})`);
              }
            }
            let value: string;
            if (checks.length === 0) {
              value = 'false';
            } else if (checks.length === 1) {
              value = checks[0]!;
            } else {
              value = `(${checks.join(' || ')})`;
            }
            if (node.callee.name === '$resolve' && memo) {
              // `$resolve(memo, options)` waits until the memo is not pending, then reads it.
              patch.replace(
                node.start,
                memo.start,
                `$$b.resolve(${declaration ? path(declaration) : scopeVar}, () => ${value}, () => `,
              );
              visit(memo);
              for (const rest of node.arguments.slice(1)) {
                visit(rest);
              }
              return;
            }
            patch.replace(node.start, node.end, value);
            return;
          }
          if (
            node.callee.type === 'Identifier' &&
            node.callee.name === '$produce' &&
            !references.has(node.callee.start) &&
            node.arguments[0]?.type === 'Identifier'
          ) {
            this.rewriteProduce(
              node,
              node.arguments[0],
              patch,
              references,
              locals,
              scopeVar,
              base,
              visit,
            );
            return;
          }
          if (
            node.callee.type === 'Identifier' &&
            node.callee.name === '$untrack' &&
            node.arguments[0] &&
            !references.has(node.callee.start)
          ) {
            const argument = node.arguments[0];
            patch.replace(node.start, argument.start, '(');
            patch.replace(argument.end, node.end, ')');
            visit(argument);
            return;
          }
          break;
        }
        case 'MemberExpression':
          visit(node.object);
          if (node.computed) {
            visit(node.property);
          }
          return;
        default:
          break;
      }
      for (const [key, child] of children(node)) {
        if (
          key === 'typeAnnotation' ||
          key === 'typeArguments' ||
          key === 'typeParameters' ||
          key === 'returnType'
        ) {
          continue;
        }
        if (node.type === 'Property' && key === 'key' && !node.computed) {
          continue;
        }
        visit(child);
      }
    };

    visit(site.node);
    options.edit?.(patch);
    return patch;
  }
}
