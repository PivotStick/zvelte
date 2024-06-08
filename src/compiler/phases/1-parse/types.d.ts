import type { CssNodePlain } from "css-tree";

interface BaseNode {
    type: string;
    start: number;
    end: number;
}

export type TemplateNode =
    | Root
    | Text
    | Tag
    | ElementLike
    | Attribute
    | Directive
    | Comment
    | Block;

export type Directive =
    | BindDirective
    | OnDirective
    | TransitionDirective
    | ClassDirective;
export type ElementLike = RegularElement | Component | ZvelteComponent;
export type Tag = ExpressionTag | HtmlTag | RenderTag | VariableTag;
export type Block = ForBlock | IfBlock | SnippetBlock | KeyBlock;
export type Expression =
    | ArrowFunctionExpression
    | ConditionalExpression
    | Identifier
    | UnaryExpression
    | BinaryExpression
    | LogicalExpression
    | StringLiteral
    | BooleanLiteral
    | NullLiteral
    | NumericLiteral
    | ObjectExpression
    | ArrayExpression
    | MemberExpression
    | FilterExpression
    | IsExpression
    | InExpression
    | RangeExpression
    | CallExpression;

export interface ClassDirective extends BaseNode {
    type: "ClassDirective";
    name: string;
    expression: Expression;
    modifiers: string[];
}

export interface TransitionDirective extends BaseNode {
    type: "TransitionDirective";
    /** The 'x' in `on:x` */
    name: string;
    /** The 'y' in `on:x={y}` */
    expression: Expression | null;
    intro: boolean;
    outro: boolean;
    modifiers: string[];
}

export interface OnDirective extends BaseNode {
    type: "OnDirective";
    /** The 'x' in `on:x` */
    name: string;
    /** The 'y' in `on:x={y}` */
    expression: null | Expression;
    modifiers: string[];
}

/** A `bind:` directive */
export interface BindDirective extends BaseNode {
    type: "BindDirective";
    /** The 'x' in `bind:x` */
    name: string;
    /** The y in `bind:x={y}` */
    expression: Identifier | MemberExpression;
    modifiers: string[];
}

export interface Component extends BaseNode {
    type: "Component";
    attributes: Array<Attribute | Directive | Spread>;
    fragment: Fragment;
    name: string;
    key: Text;
}

export interface ZvelteComponent extends BaseNode {
    type: "ZvelteComponent";
    attributes: Array<Attribute | BindDirective | OnDirective | Spread>;
    fragment: Fragment;
    name: string;
    expression: Expression;
}

export interface Comment extends BaseNode {
    type: "Comment";
    data: string;
}

export interface Fragment extends BaseNode {
    type: "Fragment";
    transparent: boolean;
    nodes: Array<ElementLike | Text | Tag | Block | Comment>;
}

export interface Text extends BaseNode {
    type: "Text";
    data: string;
}

export interface VariableTag extends BaseNode {
    type: "Variable";
    name: Identifier | MemberExpression;
    value: Expression;
}

export interface IfBlock extends BaseNode {
    type: "IfBlock";
    test: Expression;
    consequent: Fragment;
    elseif: boolean;
    alternate: null | Fragment;
}

export interface ForBlock extends BaseNode {
    type: "ForBlock";
    expression: Expression;
    key: null | Identifier | MemberExpression;
    index: Identifier | null;
    context: Identifier;
    body: Fragment;
    fallback: Fragment | null;
}

export interface SnippetBlock extends BaseNode {
    type: "SnippetBlock";
    expression: Identifier;
    parameters: Array<Identifier>;
    body: Fragment;
}

export interface KeyBlock extends BaseNode {
    type: "KeyBlock";
    expression: Expression;
    fragment: Fragment;
}

export interface ExpressionTag extends BaseNode {
    type: "ExpressionTag";
    expression: Expression;
}

export interface HtmlTag extends BaseNode {
    type: "HtmlTag";
    expression: Expression;
}

export interface RenderTag extends BaseNode {
    type: "RenderTag";
    expression: CallExpression | FilterExpression;
}

export interface Root extends BaseNode {
    type: "Root";
    fragment: Fragment;
    js: null;
    css:
        | null
        | (Omit<BaseNode, "type"> & {
              code: string;
              ast: CssNodePlain;
          });
}

export interface RegularElement extends BaseNode {
    type: "RegularElement";
    attributes: Array<Attribute | Directive | Spread>;
    fragment: Fragment;
    name: string;
}

export type Attribute = BaseNode & {
    type: "Attribute";
    name: string;
    value: true | Array<Text | ExpressionTag>;
};

export interface Spread extends BaseNode {
    type: "Spread";
    expression: Expression;
}

export interface Property extends BaseNode {
    type: "Property";
    key: Identifier | StringLiteral;
    value: Expression;
}

export interface ObjectExpression extends BaseNode {
    type: "ObjectExpression";
    properties: Property[];
}

export interface ArrayExpression extends BaseNode {
    type: "ArrayExpression";
    elements: Expression[];
}

export interface CallExpression extends BaseNode {
    type: "CallExpression";
    callee: Exclude<Expression, Identifier>;
    arguments: Expression[];
}

export interface FilterExpression extends BaseNode {
    type: "FilterExpression";
    name: Identifier;
    arguments: Expression[];
}

export type MemberExpression = BaseNode & {
    type: "MemberExpression";
    object: Expression;
} & (
        | { computed: false; property: Identifier }
        | { computed: true; property: Expression }
    );

export interface NumericLiteral extends BaseNode {
    type: "NumericLiteral";
    value: number;
    raw: string;
}

export interface BooleanLiteral extends BaseNode {
    type: "BooleanLiteral";
    value: boolean;
    raw: string;
}

export interface NullLiteral extends BaseNode {
    type: "NullLiteral";
    value: null;
    raw: string;
}

export interface StringLiteral extends BaseNode {
    type: "StringLiteral";
    value: string;
    raw: string;
}

export interface LogicalExpression extends BaseNode {
    type: "LogicalExpression";
    left: Expression;
    operator: "||" | "or" | "and" | "??";
    right: Expression;
}

export interface BinaryExpression extends BaseNode {
    type: "BinaryExpression";
    left: Expression;
    operator:
        | "+"
        | "-"
        | "/"
        | "*"
        | "~"
        | "=="
        | "!="
        | "<="
        | ">="
        | "<"
        | ">";
    right: Expression;
}

export interface IsExpression extends BaseNode {
    type: "IsExpression";
    left: Expression;
    not: boolean;
    right: Expression;
}

export interface InExpression extends BaseNode {
    type: "InExpression";
    left: Expression;
    not: boolean;
    right: Expression;
}

export interface Identifier extends BaseNode {
    type: "Identifier";
    name: string;
}

export interface UnaryExpression extends BaseNode {
    type: "UnaryExpression";
    operator: "not" | "-" | "+";
    argument: Expression;
}

export interface ConditionalExpression extends BaseNode {
    type: "ConditionalExpression";
    test: Expression;
    consequent: Expression;
    alternate: Expression;
}

export interface RangeExpression extends BaseNode {
    type: "RangeExpression";
    from: NumericLiteral;
    to: NumericLiteral;
    step: 1 | -1;
}

export interface ArrowFunctionExpression extends BaseNode {
    type: "ArrowFunctionExpression";
    expression: true;
    body: Expression;
    params: Array<Identifier>;
}

export type ZvelteNode =
    | Directive
    | Block
    | Tag
    | Expression
    | ElementLike
    | Comment
    | Fragment
    | Root
    | Attribute
    | Spread
    | Property
    | Text;
