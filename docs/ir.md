# Intermediate representation

The compiler works in four stages. Each stage reads the result of the one before it and adds information:

1. **Syntax tree.** The parsed file.
2. **Semantic model.** Scopes and declarations, with every read and write resolved.
3. **Graph.** Reactive nodes, edges, client roots and what each root reaches.
4. **Output plan.** Scope layouts, anchors and the list of modules to write.

Each stage can be printed as text. Tests compare the printed form with a snapshot, so the analysis can be tested without a browser.

## 1. Syntax tree

```ts
interface Range {
  start: number;
  end: number;
}

/** Source text that oxc parses. */
interface Expression {
  range: Range;
  code: string;
  ast: oxc.Expression;
}

interface Script {
  range: Range;
  program: oxc.Program;
}

interface SFCFile {
  filename: string;
  moduleScript?: Script;
  instanceScript?: Script;
  generics?: string;
  styles: Style[];
  templates: TemplateDecl[];
  children: Markup[];
}

type Markup =
  | ElementNode
  | ComponentNode
  | DynamicTagNode
  | FragmentNode
  | GlobalListenerNode
  | TextNode
  | InsertNode
  | Block;

interface ElementNode {
  kind: 'element';
  range: Range;
  tag: string;
  attributes: Attribute[];
  children: Markup[];
}

interface ComponentNode {
  kind: 'component';
  range: Range;
  name: string;
  attributes: Attribute[];
  children: Markup[];
}

interface InsertNode {
  kind: 'insert';
  range: Range;
  expression: Expression;
}

type Attribute =
  | { kind: 'static'; range: Range; name: string; value: string | true }
  | { kind: 'value'; range: Range; name: string; value: Expression }
  | { kind: 'event'; range: Range; event: string; modifiers: Modifier[]; handler: Expression }
  | { kind: 'ref'; range: Range; target: string } // Names a signal.
  | { kind: 'prefetch'; range: Range; strategy: 'hover' | 'visible' | 'idle' | 'none' }
  | { kind: 'spread'; range: Range; value: Expression }
  | { kind: 'computed'; range: Range; name: Expression; value: Expression | true };

interface Body {
  range: Range;
  script?: Script;
  templates: TemplateDecl[];
  children: Markup[];
}

type Block =
  | { kind: 'if'; range: Range; branches: { condition: Expression; body: Body }[]; fallback?: Body }
  | {
      kind: 'for';
      range: Range;
      item: oxc.BindingPattern;
      index?: string;
      list: Expression;
      key?: Expression | 'index';
      body: Body;
      fallback?: Body;
    }
  | { kind: 'repeat'; range: Range; index?: string; count: Expression; body: Body; fallback?: Body }
  | { kind: 'switch'; range: Range; cases: { condition: Expression; body: Body }[]; fallback?: Body }
  | { kind: 'key'; range: Range; value: Expression; body: Body }
  | { kind: 'try'; range: Range; body: Body; error?: string; reset?: string; fallback: Body }
  | { kind: 'loading'; range: Range; on?: Expression; body: Body; fallback?: Body }
  | { kind: 'portal'; range: Range; target?: Expression; body: Body }
  | { kind: 'client'; range: Range; trigger: 'visible' | 'idle' | 'load'; body: Body };

interface TemplateDecl {
  range: Range;
  name: string;
  params: oxc.FormalParameters;
  body: Body;
}
```

The remaining node types (`DynamicTagNode`, `FragmentNode`, `GlobalListenerNode`, `TextNode`, `Style`) follow the grammar directly.

## 2. Semantic model

The analyzer creates a scope for the module script, the component, each block body and each template. It resolves every identifier in scripts and markup to a declaration.

```ts
type ScopeKind = 'module' | 'component' | 'body' | 'template' | 'function';

interface Scope {
  id: number;
  kind: ScopeKind;
  parent?: Scope;
  declarations: Map<string, Declaration>;
  /** The markup that belongs to this scope, for component, body and template scopes. */
  body?: Body;
}

type DeclarationKind =
  | 'import'
  | 'module'          // A binding in <script module>.
  | 'prop'
  | 'props-rest'
  | 'signal'
  | 'memo'
  | 'async-memo'
  | 'function'
  | 'server-function'
  | 'const'           // A plain const in a component or body script.
  | 'let'             // A plain let in a component or body script.
  | 'item'            // The item of #for.
  | 'index'           // The index of #for or #repeat.
  | 'error'           // The error of #catch.
  | 'reset'           // The reset function of #catch.
  | 'template'
  | 'template-param';

interface Declaration {
  id: number;
  name: string;
  kind: DeclarationKind;
  scope: Scope;
  range: Range;
  init?: Expression;
  reads: Reference[];
  writes: Reference[];
}

interface Reference {
  range: Range;
  declaration: Declaration;
  /** The function, handler or markup expression that contains this reference. */
  site: Site;
}
```

A `Site` is a place where code runs: a function declaration, an arrow function, an attribute value, an insert or a block header.

The analyzer also reports these errors:

- An assignment to a `memo`, `async-memo`, `prop` or `const`.
- A `ref` whose target is not a `signal`.
- A server function that captures a declaration outside `module` and `import`.
- A server function that is not `async`.

## 3. Graph

```ts
type GraphNode =
  | { kind: 'source'; declaration: Declaration }   // signal, prop, item, index, error
  | { kind: 'memo'; declaration: Declaration }
  | { kind: 'binding'; target: BindingTarget; expression: Expression }
  | { kind: 'block'; block: Block; expression: Expression }
  | { kind: 'effect'; callback: Site };

type BindingTarget =
  | { kind: 'text'; node: InsertNode }
  | { kind: 'attribute'; element: ElementNode; name: string }
  | { kind: 'spread'; element: ElementNode }
  | { kind: 'prop'; component: ComponentNode; name: string }
  | { kind: 'style-variable'; variable: string };

interface Edge {
  from: GraphNode;
  to: GraphNode;
}

type ClientRoot =
  | { kind: 'handler'; element: ElementNode; event: string; modifiers: Modifier[]; site: Site }
  | { kind: 'listener'; target: 'window' | 'document'; event: string; site: Site }
  | { kind: 'effect'; site: Site }
  | { kind: 'client'; trigger: 'visible' | 'idle' | 'load'; site: Site }
  | { kind: 'client-block'; block: Block & { kind: 'client' } };
```

### Edges

A node gets an edge from every source and memo that its expression reads. Calls to local functions are followed, and their reads count as reads of the caller. Calls to imported functions are not followed. They receive values and cannot read signals.

### Reach

The compiler walks from each client root. It follows calls to local functions and records:

- Every declaration that reached code reads.
- Every declaration that reached code writes.
- Every server function that reached code calls.

### Live nodes

A node is **live** when its value can change on the client:

- A signal is live when reached code writes it, or when it is the `ref` target of an element inside a live block.
- A prop is live. The component does not know what the parent passes, so it assumes the prop can change. See [Props](#props).
- A template parameter is live when a call to the template is live or runs on the client.
- An error of `#catch` is live when the `#try` body changes on the client.
- An `item` or `index` of a `#for` is live when the list is live.
- A memo, binding, block or effect is live when any node with an edge into it is live.

A node that is not live is rendered on the server and has no client code.

### Props

A component is compiled without knowing its parents, so it treats every prop as live and writes update code for bindings that read props.

This costs nothing at runtime. Update code is in a separate module that loads on the first write that reaches it. If the parent passes a constant, nothing writes the prop, and the module never loads.

The parent decides at render time how to pass each prop:

- A value that is not live in the parent is serialized as a plain value.
- A live value is serialized as a reference to the parent's slot. A write in the parent then reaches the child's update code.

Component summaries can later remove update code for props that no parent passes as live. They are an optimization, not a requirement.

## 4. Output plan

```ts
interface ScopeLayout {
  scope: Scope;
  /** Declarations that client code reads, in slot order. */
  slots: Declaration[];
}

type Anchor =
  | { kind: 'element'; id: number; element: ElementNode }   // Written as an attribute.
  | { kind: 'text'; id: number; node: InsertNode }          // Written as a comment pair.
  | { kind: 'range'; id: number; block: Block };            // Written as a comment pair around the block.

type ClientModuleKind =
  | 'handler'       // One client root.
  | 'update'        // The update code for the live nodes of one scope.
  | 'create'        // The create code for a live block body or template.
  | 'shared'        // Local functions that more than one module reaches.
  | 'server-stub';  // RPC stubs for server functions.

interface ClientModule {
  id: string;
  kind: ClientModuleKind;
  exports: string[];
  imports: { from: string; names: string[] }[];
}

interface ServerModule {
  id: string;
  kind: 'render' | 'server-function';
  exports: string[];
}

interface OutputPlan {
  layouts: ScopeLayout[];
  anchors: Anchor[];
  client: ClientModule[];
  server: ServerModule[];
}
```

Rules:

- A declaration gets a slot when client code reads it. `module` and `import` declarations never get a slot, because client modules import them.
- A plain `let` that client code writes gets a slot. Writing it updates the slot and triggers nothing.
- An element gets an anchor when it has a handler, a live attribute binding, or a `ref` to a signal that client code reads.
- An insert gets an anchor when its binding is live.
- A block gets an anchor when its header is live.

## Example

```html
<script>
  const label = 'Clicks';
  let count = $signal(0);
  const double = $memo(count * 2);
</script>

<h1>{label}</h1>
<button onClick=(() => count++)>+</button>
<p>{count} / {double}</p>
```

Semantic model:

```
scope 0 component
  label   const   reads: insert@h1
  count   signal  reads: memo double, insert@p#0   writes: handler@button
  double  memo    reads: insert@p#1
```

Graph:

```
root handler click@button  writes count
source count        live
memo double         live    <- count
binding text h1     static  <- (none)
binding text p#0    live    <- count
binding text p#1    live    <- double
```

Output plan:

```
layout scope 0: [count, double]
anchors: element 0 button, text 1 p#0, text 2 p#1
client: handler h0 (button click), update u0 (double, text 1, text 2)
server: render Counter
```

`label` gets no slot and the `<h1>` gets no anchor, because no client code reads them.
