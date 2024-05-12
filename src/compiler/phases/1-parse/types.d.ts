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
    | VariableTag
    | Block;

export type Directive =
    | BindDirective
    | OnDirective
    | TransitionDirective
    | ClassDirective;
export type ElementLike = Element | Component | SlotElement;
export type Tag = ExpressionTag | HtmlTag | VariableTag;
export type Block = ForBlock | IfBlock;
export type Expression =
    | ConditionalExpression
    | Identifier
    | UnaryExpression
    | BinaryExpression
    | StringLiteral
    | BooleanLiteral
    | NullLiteral
    | NumericLiteral
    | ObjectExpression
    | ArrayExpression
    | MemberExpression
    | FilterExpression
    | RangeExpression
    | CallExpression;

export interface ClassDirective extends BaseNode {
    type: "ClassDirective";
    name: string;
    expression: null | Expression;
    modifiers: string[];
}

export interface TransitionDirective extends BaseNode {
    type: "TransitionDirective";
    /** The 'x' in `on:x` */
    name: string;
    /** The 'y' in `on:x={y}` */
    expression: null | Expression;
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
    expression: null | Identifier | MemberExpression;
    modifiers: string[];
}

export interface Component extends BaseNode {
    type: "Component";
    attributes: Array<Attribute | Directive>;
    fragment: Fragment;
    name: string;
    key: Text;
}

export interface Comment extends BaseNode {
    type: "Comment";
    data: string;
}

export interface Fragment extends BaseNode {
    type: "Fragment";
    nodes: (ElementLike | Text | Tag | IfBlock | ForBlock)[];
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
    key?: Identifier;
    context: Identifier;
    body: Fragment;
    fallback?: Fragment;
}

export interface ExpressionTag extends BaseNode {
    type: "ExpressionTag";
    expression: Expression;
}

export interface HtmlTag extends BaseNode {
    type: "HtmlTag";
    expression: Expression;
}

export interface Root extends BaseNode {
    type: "Root";
    fragment: Fragment;
    js: any;
    css: any;
}

export interface Element extends BaseNode {
    type: "Element";
    attributes: Array<Attribute | Directive>;
    fragment: Fragment;
    name: string;
}

export interface SlotElement extends BaseNode {
    type: "SlotElement";
    attributes: Array<Attribute>;
    fragment: Fragment;
    name: string;
}

export interface Attribute extends BaseNode {
    type: "Attribute";
    name: string;
    values: true | Array<Text | Expression>;
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
    name: Expression;
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

export interface BinaryExpression extends BaseNode {
    type: "BinaryExpression";
    left: Expression;
    operator:
        | "+"
        | "-"
        | "/"
        | "*"
        | "~"
        | "??"
        | "||"
        | "or"
        | "and"
        | "=="
        | "!="
        | "<="
        | ">="
        | "<"
        | ">"
        | "in"
        | "is";
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

export type Any =
    | Directive
    | Block
    | Tag
    | Expression
    | ElementLike
    | Comment
    | Fragment
    | Root
    | Attribute
    | Property
    | Text;
