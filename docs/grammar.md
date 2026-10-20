# Grammar

This is the grammar of a `.brm` file. It uses EBNF:

- `{ x }` means zero or more `x`.
- `[ x ]` means an optional `x`.
- `"x"` is literal text.
- `TS<rule>` is text that the TypeScript parser reads, such as `TS<Expression>`.

Whitespace between tokens is allowed unless a rule says otherwise. Names are case-sensitive.

## File

```ebnf
File            = { TopLevel } ;
TopLevel        = ModuleScript | InstanceScript | Style | TemplateDecl | Markup ;

ModuleScript    = "<script" ws "module" ">" TS<Module> "</script>" ;
InstanceScript  = "<script" [ ws "generics=" String ] ">" TS<Module> "</script>" ;
Style           = "<style" [ ws "lang=" String ] ">" CSS "</style>" ;
```

- A file has at most one `ModuleScript` and one `InstanceScript`. They can come in any order.
- A file can have any number of `Style` blocks.
- `lang` is `"css"`, `"scss"` or `"less"`.
- Scripts do not contain markup. Use a `#template` for markup that is used as a value.

## Markup

```ebnf
Markup          = Element | Component | DynamicTag | Fragment | GlobalListener
                | Text | Insert | Block | Comment ;

Element         = "<" ElementName { ws Attribute } [ ws ]
                  ( "/>" | ">" { Markup } "</" ElementName ">" )
                | "<" VoidName { ws Attribute } [ ws ] [ "/" ] ">" ;
Component       = "<" ComponentName { ws Attribute } [ ws ]
                  ( "/>" | ">" { Markup } "</" ComponentName ">" ) ;
DynamicTag      = "<{" TS<Expression> "}" { ws Attribute } [ ws ]
                  ( "/>" | ">" { Markup } "</>" ) ;
Fragment        = "<>" { Markup } "</>" ;
GlobalListener  = "<" ( "window" | "document" ) { ws EventAttribute } [ ws ] "/>" ;

Insert          = "{" TS<Expression> "}" ;
Text            = TextChar { TextChar } ;
Comment         = "<!--" { any } "-->" ;

ElementName     = Lower { NameChar } ;
ComponentName   = Upper { IdentChar } { "." Ident } ;
VoidName        = "area" | "base" | "br" | "col" | "embed" | "hr" | "img"
                | "input" | "link" | "meta" | "source" | "track" | "wbr" ;
```

- `ElementName` excludes `window`, `document` and `script`. `<script>` is only allowed at the top level and at the start of a block body.
- `<style>` is only allowed at the top level.
- `TextChar` is any character except `<`, `{` and a `#` that starts a block. See [`#` in text](#-in-text).

## Attributes

```ebnf
Attribute       = EventAttribute | RefAttribute | PrefetchAttribute
                | NamedAttribute | Shorthand | Spread | Computed ;

EventAttribute  = EventName { ":" Modifier } "=" Value ;
EventName       = "on" Upper { IdentChar } ;
Modifier        = "prevent" | "stop" | "passive" | "once" | "capture" ;

RefAttribute    = "ref=" Ident ;
PrefetchAttribute = "prefetch=" ( '"hover"' | '"visible"' | '"idle"' | '"none"' ) ;

NamedAttribute  = AttributeName [ "=" Value ] ;
AttributeName   = NameStart { NameChar } [ ":" NameStart { NameChar } ] ;
Shorthand       = "{" Ident "}" ;
Spread          = "{..." TS<Expression> "}" ;
Computed        = "[" TS<Expression> "]" [ "=" Value ] ;
```

- A name that matches `EventName` is always an event. Its `:` segments are modifiers. Any other name can have one `:` namespace, as in `xlink:href`.
- `ref` and `prefetch` are reserved names on elements. On components they are ordinary props.
- Attributes must be separated by whitespace.

## Attribute values

```ebnf
Value           = String | Bare | Paren | ObjectValue | TemplateLiteral
                | ArrayLiteral | RegExp | Element | Component ;

String          = '"' { any - '"' } '"' | "'" { any - "'" } "'" ;
Paren           = "(" TS<Expression> ")" ;
ObjectValue     = "{" TS<ObjectBody> "}" ;
Bare            = { Prefix } Primary { Access } ;
Prefix          = "!" | "-" | "+" | "~" ;
Primary         = Ident | Number | "true" | "false" | "null" ;
Access          = "." Ident | "?." Ident | "(" TS<Arguments> ")"
                | "[" TS<Expression> "]" | "!" ;
```

- A `Bare` value ends at whitespace, `/` or `>`. It has no whitespace between its parts, except inside brackets.
- Braces hold an object literal. `value={count}` passes the object `{ count }`.
- Any other expression goes in parentheses: `disabled=(count > 3)`.

## Blocks

```ebnf
Block           = IfBlock | ForBlock | RepeatBlock | SwitchBlock | KeyBlock
                | TryBlock | LoadingBlock | PortalBlock | StaticBlock | ClientBlock ;

Body            = "{" [ BlockScript ] { TemplateDecl } { Markup } "}" ;
BlockScript     = "<script>" TS<Module> "</script>" ;

IfBlock         = "#if" "(" TS<Expression> ")" Body
                  { "#else" "if" "(" TS<Expression> ")" Body }
                  [ "#else" Body ] ;
ForBlock        = "#for" "(" TS<BindingPattern> [ "," Ident ] "of" TS<Expression>
                  [ "by" TS<Expression> ] ")" Body [ "#else" Body ] ;
RepeatBlock     = "#repeat" "(" [ Ident "of" ] TS<Expression> ")" Body [ "#else" Body ] ;
SwitchBlock     = "#switch" "{" { "#case" "(" TS<Expression> ")" Body }
                  [ "#default" Body ] "}" ;
KeyBlock        = "#key" "(" TS<Expression> ")" Body ;
TryBlock        = "#try" Body "#catch" [ "(" Ident [ "," Ident ] ")" ] Body ;
LoadingBlock    = "#loading" [ "(" TS<Expression> ")" ] Body [ "#else" Body ] ;
PortalBlock     = "#portal" [ "(" TS<Expression> ")" ] Body ;
StaticBlock     = "#static" Body ;
ClientBlock     = "#client" [ "(" Trigger ")" ] Body ;
Trigger         = '"visible"' | '"idle"' | '"load"'
                | "'visible'" | "'idle'" | "'load'" ;

TemplateDecl    = "#template" Ident "(" TS<Parameters> ")" Body ;
```

- `#else`, `#else if` and `#catch` come right after the body of their block. Only whitespace and comments may be in between.
- In `ForBlock`, `by` followed by the index name keys items by position.
- Only `#case`, `#default`, whitespace and comments are allowed directly inside `#switch`. `#default` is last.
- A `BlockScript` cannot export and cannot call `$props()`.
- A `TemplateDecl` at the top level can be used anywhere in the file. In a body, it can be used in that body.

## `#` in text

`#` starts a block only when all of these are true:

- It does not come right after a letter, a digit, `_` or `$`.
- A block keyword follows: `if`, `for`, `repeat`, `switch`, `key`, `try`, `loading`, `portal`, `static`, `client` or `template`.
- The keyword is followed by `(` or `{`. `#template` is followed by a name.

Inside a block, `else`, `catch`, `case` and `default` are also keywords where the grammar expects them. Any other `#` is text.

## Expressions

The scanner finds where a `TS<…>` region ends by matching brackets. It skips strings, template literals, regular expressions and comments while it counts. The region is then parsed with oxc.

Inside an expression, `<` starts markup when a value is expected, as in solid-sfc. Generic type parameters such as `<T,>` and `<T extends U>` are read as types.

## Differences from solid-sfc

- `<window>` and `<document>` replace `<solid:window>` and `<solid:document>`.
- Event attributes take `:` modifiers.
- `ref` and `prefetch` are reserved on elements.
- `#static` and `#client` are added. `#hydration`, `#no-hydration` and `#reveal` are removed.
- Scripts cannot contain markup.
