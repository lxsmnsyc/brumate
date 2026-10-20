import type {
  Attribute,
  Block,
  Body,
  Branch,
  ClientTrigger,
  EventAttribute,
  Expression,
  Markup,
  Modifier,
  PrefetchStrategy,
  SFCFile,
  Script,
  Style,
  TemplateDecl,
} from './ast.ts';
import { createFail } from './error.ts';
import type { Fail } from './error.ts';
import { parseExpression, parseParameters, parsePattern, parseScript } from './oxc.ts';
import type { oxc } from './oxc.ts';
import {
  findTopLevel,
  isIdentifierPart,
  isIdentifierStart,
  isWhitespace,
  readIdentifier,
  skipBalanced,
  skipComment,
  skipRegExp,
  skipString,
  skipTemplate,
} from './scan.ts';

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

const BLOCK_KEYWORDS = new Set([
  'if',
  'for',
  'repeat',
  'switch',
  'key',
  'try',
  'loading',
  'portal',
  'head',
  'client',
  'template',
]);

const BRANCH_KEYWORDS = new Set(['else', 'catch', 'case', 'default']);

const MODIFIERS = new Set<string>(['prevent', 'stop', 'passive', 'once', 'capture']);

const PREFETCH_STRATEGIES = new Set<string>(['hover', 'visible', 'idle', 'none']);

const CLIENT_TRIGGERS = new Set<string>(['visible', 'idle', 'load']);

type Mode = 'file' | 'body' | 'element';

export interface ParseOptions {
  /** Used for error messages. */
  filename?: string;
}

export function parse(source: string, options: ParseOptions = {}): SFCFile {
  return new Parser(source, options.filename ?? 'Component.brm').parseFile();
}

class Parser {
  private pos = 0;
  private readonly source: string;
  private readonly fail: Fail;
  private readonly file: SFCFile;

  constructor(source: string, filename: string) {
    this.source = source;
    this.fail = createFail(source, filename);
    this.file = { filename, source, styles: [], templates: [], children: [] };
  }

  parseFile(): SFCFile {
    this.file.children = this.parseNodes('file', this.file.templates);
    return this.file;
  }

  // Helpers

  private startsWith(text: string): boolean {
    return this.source.startsWith(text, this.pos);
  }

  private peek(): string | undefined {
    return this.source[this.pos];
  }

  private skipWhitespace(): boolean {
    const start = this.pos;
    while (isWhitespace(this.peek())) {
      this.pos++;
    }
    return this.pos > start;
  }

  /** Skips whitespace and HTML comments. */
  private skipTrivia(): void {
    for (;;) {
      this.skipWhitespace();
      if (!this.startsWith('<!--')) {
        return;
      }
      this.skipHTMLComment();
    }
  }

  private skipHTMLComment(): void {
    const end = this.source.indexOf('-->', this.pos + 4);
    if (end === -1) {
      this.fail('Unterminated comment', this.pos);
    }
    this.pos = end + 3;
  }

  private expect(text: string, message = `Expected "${text}"`): void {
    if (!this.startsWith(text)) {
      this.fail(message, this.pos);
    }
    this.pos += text.length;
  }

  /** Parses the code between `start` and `end` as an expression. */
  private expression(start: number, end: number): Expression {
    const code = this.source.slice(start, end);
    return { start, end, code, ast: parseExpression(code, start, this.fail) };
  }

  /** Reads a bracketed region at the current position. Returns the range inside the brackets. */
  private bracketed(): { start: number; end: number } {
    const open = this.pos;
    this.pos = skipBalanced(this.source, open, this.fail);
    return { start: open + 1, end: this.pos - 1 };
  }

  private isTagStart(name: string): boolean {
    const next = this.source[this.pos + name.length + 1];
    return this.startsWith(`<${name}`) && (isWhitespace(next) || next === '>' || next === '/');
  }

  /** Returns the keyword of a block that starts at the current position. */
  private blockKeyword(keywords: Set<string>): string | undefined {
    if (this.peek() !== '#' || isIdentifierPart(this.source[this.pos - 1])) {
      return undefined;
    }
    const match = /^[a-z]+/.exec(this.source.slice(this.pos + 1, this.pos + 20));
    if (!match || !keywords.has(match[0])) {
      return undefined;
    }
    const keyword = match[0];
    let next = this.pos + 1 + keyword.length;
    if (keyword === 'template') {
      if (!isWhitespace(this.source[next])) {
        return undefined;
      }
      while (isWhitespace(this.source[next])) {
        next++;
      }
      return isIdentifierStart(this.source[next]) ? keyword : undefined;
    }
    while (isWhitespace(this.source[next])) {
      next++;
    }
    const after = this.source[next];
    if (after === '(' || after === '{') {
      return keyword;
    }
    // `#else if` has a keyword after `#else`.
    if (keyword === 'else' && this.source.startsWith('if', next)) {
      return keyword;
    }
    return undefined;
  }

  // Nodes

  private parseNodes(mode: Mode, templates?: TemplateDecl[]): Markup[] {
    const nodes: Markup[] = [];
    for (;;) {
      if (this.pos >= this.source.length) {
        if (mode !== 'file') {
          this.fail(
            mode === 'body'
              ? 'Expected "}" to close the block'
              : 'Unexpected end of file, expected a closing tag',
            this.pos,
          );
        }
        return nodes;
      }
      if (mode === 'body' && this.peek() === '}') {
        return nodes;
      }
      if (this.startsWith('</')) {
        if (mode === 'element') {
          return nodes;
        }
        this.fail('Unexpected closing tag', this.pos);
      }
      if (this.startsWith('<!--')) {
        this.skipHTMLComment();
        continue;
      }
      if (this.isTagStart('script')) {
        if (mode !== 'file') {
          this.fail('<script> must be at the top level or at the start of a block', this.pos);
        }
        this.parseTopLevelScript();
        continue;
      }
      if (this.isTagStart('style')) {
        if (mode !== 'file') {
          this.fail('<style> must be at the top level', this.pos);
        }
        this.file.styles.push(this.parseStyle());
        continue;
      }
      if (this.peek() === '<') {
        nodes.push(this.parseTag());
        continue;
      }
      if (this.peek() === '{') {
        const start = this.pos;
        const inner = this.bracketed();
        nodes.push({
          kind: 'insert',
          start,
          end: this.pos,
          expression: this.expression(inner.start, inner.end),
        });
        continue;
      }
      const keyword = this.blockKeyword(BLOCK_KEYWORDS);
      if (keyword === 'template') {
        if (!templates) {
          this.fail('#template must be at the top level or at the start of a block', this.pos);
        }
        templates.push(this.parseTemplate());
        continue;
      }
      if (keyword) {
        nodes.push(this.parseBlock(keyword));
        continue;
      }
      const branch = this.blockKeyword(BRANCH_KEYWORDS);
      if (branch) {
        this.fail(`#${branch} must follow its block`, this.pos);
      }
      this.parseText(nodes, mode);
    }
  }

  private parseText(nodes: Markup[], mode: Mode): void {
    const start = this.pos;
    this.pos++;
    while (this.pos < this.source.length) {
      const char = this.peek();
      if (char === '<' || char === '{' || (char === '}' && mode === 'body')) {
        break;
      }
      if (
        char === '#' &&
        (this.blockKeyword(BLOCK_KEYWORDS) || this.blockKeyword(BRANCH_KEYWORDS))
      ) {
        break;
      }
      this.pos++;
    }
    const value = this.source.slice(start, this.pos);
    // As in JSX, text that is only whitespace across lines is dropped.
    if (value.trim() === '' && value.includes('\n')) {
      return;
    }
    nodes.push({ kind: 'text', start, end: this.pos, value });
  }

  private parseTag(): Markup {
    const start = this.pos;
    if (this.startsWith('<>')) {
      this.pos += 2;
      const children = this.parseNodes('element');
      this.expect('</>');
      return { kind: 'fragment', start, end: this.pos, children };
    }
    if (this.startsWith('<{')) {
      this.pos++;
      const inner = this.bracketed();
      const tag = this.expression(inner.start, inner.end);
      const attributes = this.parseAttributes('dynamic');
      let children: Markup[] = [];
      if (this.startsWith('/>')) {
        this.pos += 2;
      } else {
        this.pos++;
        children = this.parseNodes('element');
        this.expect('</>');
      }
      return { kind: 'dynamic', start, end: this.pos, tag, attributes, children };
    }
    this.pos++;
    const match = /^[A-Za-z][\w.:-]*/.exec(this.source.slice(this.pos, this.pos + 200));
    if (!match) {
      return this.fail('Expected a tag name', this.pos);
    }
    const name = match[0];
    this.pos += name.length;

    if (name === 'window' || name === 'document') {
      const attributes = this.parseAttributes('listener');
      if (!this.startsWith('/>')) {
        this.fail(`<${name}> must end with "/>"`, this.pos);
      }
      this.pos += 2;
      return {
        kind: 'listener',
        start,
        end: this.pos,
        target: name,
        attributes: attributes as EventAttribute[],
      };
    }

    const isComponent = /^[A-Z]/.test(name);
    const attributes = this.parseAttributes(isComponent ? 'component' : 'element');
    let children: Markup[] = [];
    if (this.startsWith('/>')) {
      this.pos += 2;
    } else {
      this.pos++;
      if (isComponent || !VOID_ELEMENTS.has(name)) {
        children = this.parseNodes('element');
        const close = `</${name}`;
        if (!this.startsWith(close)) {
          this.fail(`Expected </${name}>`, this.pos);
        }
        this.pos += close.length;
        this.skipWhitespace();
        this.expect('>', `Expected </${name}>`);
      }
    }
    if (isComponent) {
      return { kind: 'component', start, end: this.pos, name, attributes, children };
    }
    return { kind: 'element', start, end: this.pos, tag: name, attributes, children };
  }

  // Attributes

  private parseAttributes(owner: 'element' | 'component' | 'dynamic' | 'listener'): Attribute[] {
    const attributes: Attribute[] = [];
    for (;;) {
      const separated = this.skipWhitespace();
      if (this.pos >= this.source.length) {
        this.fail('Unexpected end of file, expected ">"', this.pos);
      }
      if (this.peek() === '>' || this.startsWith('/>')) {
        return attributes;
      }
      if (!separated) {
        this.fail('Expected whitespace between attributes', this.pos);
      }
      const attribute = this.parseAttribute(owner);
      if (owner === 'listener' && attribute.kind !== 'event') {
        this.fail('Only event handlers are allowed here', attribute.start);
      }
      attributes.push(attribute);
    }
  }

  private parseAttribute(owner: 'element' | 'component' | 'dynamic' | 'listener'): Attribute {
    const start = this.pos;
    if (this.peek() === '{') {
      const inner = this.bracketed();
      const code = this.source.slice(inner.start, inner.end);
      if (code.startsWith('...')) {
        return {
          kind: 'spread',
          start,
          end: this.pos,
          value: this.expression(inner.start + 3, inner.end),
        };
      }
      const name = code.trim();
      if (readIdentifier(name, 0) !== name) {
        this.fail('Expected a spread or a shorthand attribute', start);
      }
      return {
        kind: 'value',
        start,
        end: this.pos,
        name,
        value: this.expression(inner.start, inner.end),
      };
    }
    if (this.peek() === '[') {
      const inner = this.bracketed();
      const name = this.expression(inner.start, inner.end);
      let value: Expression | true = true;
      if (this.peek() === '=') {
        this.pos++;
        const parsed = this.parseValue();
        value = typeof parsed === 'string' ? this.stringExpression(parsed) : parsed;
      }
      return { kind: 'computed', start, end: this.pos, name, value };
    }

    const match = /^[A-Za-z_][\w-]*(?::[\w-]+)*/.exec(this.source.slice(this.pos, this.pos + 200));
    if (!match) {
      return this.fail('Expected an attribute name', this.pos);
    }
    const fullName = match[0];
    this.pos += fullName.length;
    const parts = fullName.split(':');

    if (/^on[A-Z]/.test(fullName)) {
      const name = parts[0]!;
      const modifiers = parts.slice(1);
      for (const modifier of modifiers) {
        if (!MODIFIERS.has(modifier)) {
          this.fail(`Unknown event modifier ":${modifier}"`, start);
        }
      }
      if (this.peek() !== '=') {
        this.fail('Expected an event handler', this.pos);
      }
      this.pos++;
      const value = this.parseValue();
      if (typeof value === 'string') {
        return this.fail('An event handler must be an expression, not a string', start);
      }
      return {
        kind: 'event',
        start,
        end: this.pos,
        name,
        event: name.slice(2).toLowerCase(),
        modifiers: modifiers as Modifier[],
        handler: value,
      };
    }
    if (parts.length > 2) {
      this.fail('An attribute name can have one ":" namespace', start);
    }

    if (owner === 'element' && fullName === 'ref') {
      this.expect('=', 'Expected the name of a signal after "ref="');
      const targetStart = this.pos;
      const target = readIdentifier(this.source, this.pos);
      this.pos += target.length;
      if (!target || !(isWhitespace(this.peek()) || this.peek() === '>' || this.peek() === '/')) {
        this.fail('Expected the name of a signal after "ref="', targetStart);
      }
      return {
        kind: 'ref',
        start,
        end: this.pos,
        target,
        targetRange: { start: targetStart, end: this.pos },
      };
    }

    if (owner === 'element' && fullName === 'prefetch') {
      this.expect('=', 'Expected a prefetch strategy');
      const value = this.parseValue();
      if (typeof value !== 'string' || !PREFETCH_STRATEGIES.has(value)) {
        this.fail('prefetch must be "hover", "visible", "idle" or "none"', start);
      }
      return { kind: 'prefetch', start, end: this.pos, strategy: value as PrefetchStrategy };
    }

    if (this.peek() !== '=') {
      return { kind: 'static', start, end: this.pos, name: fullName, value: true };
    }
    this.pos++;
    const value = this.parseValue();
    if (typeof value === 'string') {
      return { kind: 'static', start, end: this.pos, name: fullName, value };
    }
    return { kind: 'value', start, end: this.pos, name: fullName, value };
  }

  /** Makes an expression for a string value, such as the value of a computed attribute. */
  private stringExpression(value: string): Expression {
    const start = this.pos - value.length - 2;
    return this.expression(start, this.pos);
  }

  /** Parses an attribute value. Returns a string for a quoted value. */
  private parseValue(): string | Expression {
    const start = this.pos;
    const char = this.peek();
    if (char === '"' || char === "'") {
      this.pos = skipString(this.source, start, this.fail);
      return this.source.slice(start + 1, this.pos - 1);
    }
    if (char === '(') {
      const inner = this.bracketed();
      return this.expression(inner.start, inner.end);
    }
    if (char === '{' || char === '[') {
      this.pos = skipBalanced(this.source, start, this.fail);
      return this.expression(start, this.pos);
    }
    if (char === '`') {
      this.pos = skipTemplate(this.source, start, this.fail);
      return this.expression(start, this.pos);
    }
    if (char === '/') {
      this.pos = skipRegExp(this.source, start, this.fail);
      return this.expression(start, this.pos);
    }
    if (char === '<') {
      return this.fail('Markup is not allowed in attribute values. Use a #template.', start);
    }

    while (
      this.peek() === '!' ||
      this.peek() === '-' ||
      this.peek() === '+' ||
      this.peek() === '~'
    ) {
      this.pos++;
    }
    const primary = /^(?:[A-Za-z_$][\w$]*|\d[\w.]*|\.\d[\w]*)/.exec(
      this.source.slice(this.pos, this.pos + 200),
    );
    if (!primary) {
      return this.fail('Expected an attribute value', start);
    }
    this.pos += primary[0].length;
    for (;;) {
      if (this.startsWith('?.') && isIdentifierStart(this.source[this.pos + 2])) {
        this.pos += 2;
        this.pos += readIdentifier(this.source, this.pos).length;
      } else if (this.peek() === '.' && isIdentifierStart(this.source[this.pos + 1])) {
        this.pos++;
        this.pos += readIdentifier(this.source, this.pos).length;
      } else if (this.peek() === '(' || this.peek() === '[') {
        this.pos = skipBalanced(this.source, this.pos, this.fail);
      } else if (this.peek() === '!') {
        this.pos++;
      } else {
        break;
      }
    }
    if (
      !(
        this.pos >= this.source.length ||
        isWhitespace(this.peek()) ||
        this.peek() === '>' ||
        this.peek() === '/'
      )
    ) {
      this.fail('Wrap this attribute value in parentheses', start);
    }
    return this.expression(start, this.pos);
  }

  // Scripts and styles

  /** Reads the attributes of a `<script>` or `<style>` tag. */
  private parseBlockTag(name: string): {
    attributes: Record<string, string | true>;
    contentStart: number;
  } {
    this.pos += name.length + 1;
    const attributes: Record<string, string | true> = {};
    for (;;) {
      this.skipWhitespace();
      if (this.peek() === '>') {
        this.pos++;
        return { attributes, contentStart: this.pos };
      }
      const attribute = /^[A-Za-z][\w-]*/.exec(this.source.slice(this.pos, this.pos + 100));
      if (!attribute) {
        return this.fail(`Expected ">" to end <${name}>`, this.pos);
      }
      this.pos += attribute[0].length;
      if (this.peek() === '=') {
        this.pos++;
        const valueStart = this.pos;
        if (this.peek() !== '"' && this.peek() !== "'") {
          this.fail('Expected a quoted value', this.pos);
        }
        this.pos = skipString(this.source, valueStart, this.fail);
        attributes[attribute[0]] = this.source.slice(valueStart + 1, this.pos - 1);
      } else {
        attributes[attribute[0]] = true;
      }
    }
  }

  private readBlockContent(name: string, contentStart: number): { contentEnd: number } {
    const close = `</${name}>`;
    const contentEnd = this.source.indexOf(close, contentStart);
    if (contentEnd === -1) {
      this.fail(`Expected ${close}`, contentStart);
    }
    this.pos = contentEnd + close.length;
    return { contentEnd };
  }

  private parseScriptBlock(): { script: Script; attributes: Record<string, string | true> } {
    const start = this.pos;
    const { attributes, contentStart } = this.parseBlockTag('script');
    const { contentEnd } = this.readBlockContent('script', contentStart);
    const program = parseScript(
      this.source.slice(contentStart, contentEnd),
      contentStart,
      this.fail,
    );
    return { script: { start, end: this.pos, program }, attributes };
  }

  private parseTopLevelScript(): void {
    const start = this.pos;
    const { script, attributes } = this.parseScriptBlock();
    for (const name of Object.keys(attributes)) {
      if (name !== 'module' && name !== 'generics' && name !== 'lang') {
        this.fail(`Unknown <script> attribute "${name}"`, start);
      }
    }
    if (attributes.module) {
      if (this.file.moduleScript) {
        this.fail('A file can have one <script module>', start);
      }
      this.file.moduleScript = script;
      return;
    }
    if (this.file.instanceScript) {
      this.fail('A file can have one <script>', start);
    }
    this.file.instanceScript = script;
    if (typeof attributes.generics === 'string') {
      this.file.generics = attributes.generics;
    }
  }

  private parseStyle(): Style {
    const start = this.pos;
    const { attributes, contentStart } = this.parseBlockTag('style');
    const { contentEnd } = this.readBlockContent('style', contentStart);
    const lang = attributes.lang ?? 'css';
    if (lang !== 'css' && lang !== 'scss' && lang !== 'less') {
      return this.fail('lang must be "css", "scss" or "less"', start);
    }
    const variables: Expression[] = [];
    let i = contentStart;
    while (i < contentEnd) {
      const end = skipComment(this.source, i, this.fail);
      if (end !== i) {
        i = end;
      } else if (this.source.startsWith('${', i)) {
        const close = skipBalanced(this.source, i + 1, this.fail);
        variables.push(this.expression(i + 2, close - 1));
        i = close;
      } else {
        i++;
      }
    }
    return {
      start,
      end: this.pos,
      lang,
      content: this.source.slice(contentStart, contentEnd),
      variables,
    };
  }

  // Blocks

  /** Parses `( … )` at the current position, after optional whitespace. */
  private parseHeader(
    keyword: string,
    required: boolean,
  ): { start: number; end: number } | undefined {
    this.skipWhitespace();
    if (this.peek() !== '(') {
      if (required) {
        this.fail(`Expected "(" after #${keyword}`, this.pos);
      }
      return undefined;
    }
    const inner = this.bracketed();
    if (this.source.slice(inner.start, inner.end).trim() === '') {
      this.fail(`Expected an expression after #${keyword}`, inner.start);
    }
    return inner;
  }

  private parseBody(keyword: string): Body {
    this.skipWhitespace();
    if (this.peek() !== '{') {
      this.fail(`Expected "{" after #${keyword}`, this.pos);
    }
    const start = this.pos;
    this.pos++;
    this.skipTrivia();
    let script: Script | undefined;
    if (this.isTagStart('script')) {
      const scriptStart = this.pos;
      const parsed = this.parseScriptBlock();
      if (Object.keys(parsed.attributes).length > 0) {
        this.fail('The script of a block takes no attributes', scriptStart);
      }
      script = parsed.script;
    }
    const templates: TemplateDecl[] = [];
    const children = this.parseNodes('body', templates);
    this.pos++;
    return { start, end: this.pos, script, templates, children };
  }

  /** Consumes `#keyword` if it comes next, after whitespace and comments. */
  private parseBranch(keyword: string): boolean {
    const saved = this.pos;
    this.skipTrivia();
    if (this.blockKeyword(BRANCH_KEYWORDS) === keyword) {
      this.pos += keyword.length + 1;
      return true;
    }
    this.pos = saved;
    return false;
  }

  private parseBlock(keyword: string): Block {
    const start = this.pos;
    this.pos += keyword.length + 1;
    switch (keyword) {
      case 'if': {
        const branches: Branch[] = [];
        let header = this.parseHeader('if', true)!;
        branches.push({
          condition: this.expression(header.start, header.end),
          body: this.parseBody('if'),
        });
        let fallback: Body | undefined;
        while (this.parseBranch('else')) {
          this.skipWhitespace();
          if (this.startsWith('if') && !isIdentifierPart(this.source[this.pos + 2])) {
            this.pos += 2;
            header = this.parseHeader('else if', true)!;
            branches.push({
              condition: this.expression(header.start, header.end),
              body: this.parseBody('else if'),
            });
          } else {
            fallback = this.parseBody('else');
            break;
          }
        }
        return { kind: 'if', start, end: this.pos, branches, fallback };
      }
      case 'for':
        return this.parseFor(start);
      case 'repeat': {
        const header = this.parseHeader('repeat', true)!;
        const code = this.source.slice(header.start, header.end);
        const of = findTopLevel(code, 'of', this.fail);
        let index: oxc.BindingIdentifier | undefined;
        let countStart = header.start;
        if (of !== -1) {
          index = this.parseIdentifier(
            header.start,
            header.start + of,
            'Expected "index of count" after #repeat',
          );
          countStart = header.start + of + 2;
        }
        const count = this.expression(countStart, header.end);
        const body = this.parseBody('repeat');
        const fallback = this.parseBranch('else') ? this.parseBody('else') : undefined;
        return { kind: 'repeat', start, end: this.pos, index, count, body, fallback };
      }
      case 'switch':
        return this.parseSwitch(start);
      case 'key': {
        const header = this.parseHeader('key', true)!;
        const value = this.expression(header.start, header.end);
        return { kind: 'key', start, end: this.pos, value, body: this.parseBody('key') };
      }
      case 'try': {
        const body = this.parseBody('try');
        if (!this.parseBranch('catch')) {
          this.fail('#try needs a #catch block', this.pos);
        }
        const header = this.parseHeader('catch', false);
        let error: oxc.BindingIdentifier | undefined;
        let reset: oxc.BindingIdentifier | undefined;
        if (header) {
          const code = this.source.slice(header.start, header.end);
          const comma = findTopLevel(code, ',', this.fail);
          const errorEnd = comma === -1 ? header.end : header.start + comma;
          error = this.parseIdentifier(
            header.start,
            errorEnd,
            'Expected "(error, reset)" after #catch',
          );
          if (comma !== -1) {
            reset = this.parseIdentifier(
              errorEnd + 1,
              header.end,
              'Expected "(error, reset)" after #catch',
            );
          }
        }
        const fallback = this.parseBody('catch');
        return { kind: 'try', start, end: this.pos, body, error, reset, fallback };
      }
      case 'loading': {
        const header = this.parseHeader('loading', false);
        const on = header ? this.expression(header.start, header.end) : undefined;
        const body = this.parseBody('loading');
        const fallback = this.parseBranch('else') ? this.parseBody('else') : undefined;
        return { kind: 'loading', start, end: this.pos, on, body, fallback };
      }
      case 'head':
        return { kind: 'head', start, end: this.pos, body: this.parseBody('head') };
      case 'portal': {
        const header = this.parseHeader('portal', false);
        const target = header ? this.expression(header.start, header.end) : undefined;
        return { kind: 'portal', start, end: this.pos, target, body: this.parseBody('portal') };
      }
      case 'client': {
        const header = this.parseHeader('client', false);
        let trigger: ClientTrigger = 'visible';
        if (header) {
          const code = this.source.slice(header.start, header.end).trim();
          const value = code.slice(1, -1);
          if (!/^(['"]).*\1$/.test(code) || !CLIENT_TRIGGERS.has(value)) {
            this.fail('The trigger of #client must be "visible", "idle" or "load"', header.start);
          }
          trigger = value as ClientTrigger;
        }
        return { kind: 'client', start, end: this.pos, trigger, body: this.parseBody('client') };
      }
      default:
        return this.fail(`Unknown block #${keyword}`, start);
    }
  }

  private parseIdentifier(start: number, end: number, message: string): oxc.BindingIdentifier {
    const pattern = parsePattern(this.source.slice(start, end), start, this.fail);
    if (pattern.type !== 'Identifier') {
      return this.fail(message, start);
    }
    return pattern;
  }

  private parseFor(start: number): Block {
    const header = this.parseHeader('for', true)!;
    const code = this.source.slice(header.start, header.end);
    const message = 'Expected "item of list" or "item, index of list" after #for';
    const of = findTopLevel(code, 'of', this.fail);
    if (of === -1) {
      this.fail(message, header.start);
    }
    const left = code.slice(0, of);
    const comma = findTopLevel(left, ',', this.fail);
    const itemEnd = comma === -1 ? header.start + of : header.start + comma;
    const item = parsePattern(this.source.slice(header.start, itemEnd), header.start, this.fail);
    let index: oxc.BindingIdentifier | undefined;
    if (comma !== -1) {
      index = this.parseIdentifier(itemEnd + 1, header.start + of, message);
    }

    const listStart = header.start + of + 2;
    const by = findTopLevel(this.source.slice(listStart, header.end), 'by', this.fail);
    const listEnd = by === -1 ? header.end : listStart + by;
    const list = this.expression(listStart, listEnd);
    let key: Expression | 'index' | undefined;
    if (by !== -1) {
      const keyStart = listEnd + 2;
      const keyCode = this.source.slice(keyStart, header.end).trim();
      key =
        keyCode === 'index' || keyCode === index?.name
          ? 'index'
          : this.expression(keyStart, header.end);
    }
    const body = this.parseBody('for');
    const fallback = this.parseBranch('else') ? this.parseBody('else') : undefined;
    return { kind: 'for', start, end: this.pos, item, index, list, key, body, fallback };
  }

  private parseSwitch(start: number): Block {
    this.skipWhitespace();
    this.expect('{', 'Expected "{" after #switch');
    const cases: Branch[] = [];
    let fallback: Body | undefined;
    for (;;) {
      this.skipTrivia();
      if (this.peek() === '}') {
        this.pos++;
        return { kind: 'switch', start, end: this.pos, cases, fallback };
      }
      const keyword = this.blockKeyword(BRANCH_KEYWORDS);
      if (keyword !== 'case' && keyword !== 'default') {
        return this.fail('Only #case and #default are allowed in #switch', this.pos);
      }
      if (fallback) {
        this.fail('#default must be the last branch of #switch', this.pos);
      }
      this.pos += keyword.length + 1;
      if (keyword === 'case') {
        const header = this.parseHeader('case', true)!;
        cases.push({
          condition: this.expression(header.start, header.end),
          body: this.parseBody('case'),
        });
      } else {
        fallback = this.parseBody('default');
      }
    }
  }

  private parseTemplate(): TemplateDecl {
    const start = this.pos;
    this.pos += '#template'.length;
    this.skipWhitespace();
    const nameStart = this.pos;
    const name = readIdentifier(this.source, this.pos);
    this.pos += name.length;
    this.skipWhitespace();
    if (this.peek() !== '(') {
      this.fail('Expected "(" after the name of the template', this.pos);
    }
    const inner = this.bracketed();
    const params = parseParameters(
      this.source.slice(inner.start, inner.end),
      inner.start,
      this.fail,
    );
    const body = this.parseBody('template');
    return {
      kind: 'template',
      start,
      end: this.pos,
      name,
      nameRange: { start: nameStart, end: nameStart + name.length },
      params,
      body,
    };
  }
}
