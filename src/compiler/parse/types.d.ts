type BaseNode = {
    start: number;
    end: number;
};

export type TemplateNode =
    | Root
    | Text
    | Tag
    | ElementLike
    | Attribute
    | Directive
    | Comment
    | Block;

export type Directive = BindDirective | OnDirective;

export type ElementLike = Element | Component | SlotElement;

export interface OnDirective extends BaseNode {
    type: "OnDirective";
    /** The 'x' in `on:x` */
    name: string;
    /** The 'y' in `on:x={y}` */
    expression: null | Expression;
    modifiers: string[]; // TODO specify
}

/** A `bind:` directive */
export interface BindDirective extends BaseNode {
    type: "BindDirective";
    /** The 'x' in `bind:x` */
    name: string;
    /** The y in `bind:x={y}` */
    expression: Identifier | MemberExpression;
}

export type Tag = ExpressionTag | HtmlTag;

export type Block = ForBlock | IfBlock;

export type Component = BaseNode & {
    type: "Component";
    attributes: Array<Attribute | Directive>;
    fragment: Fragment;
    name: string;
    key: Text;
};

export type Comment = BaseNode & {
    type: "Comment";
    data: string;
};

export type Fragment = {
    type: "Fragment";
    nodes: (ElementLike | Text | Tag | IfBlock | ForBlock)[];
};

export type IfBlock = BaseNode & {
    type: "IfBlock";
    test: Expression;
    consequent: Fragment;
    elseif: boolean;
    alternate?: Fragment;
};

export type ForBlock = BaseNode & {
    type: "ForBlock";
    expression: Expression;
    context: Identifier;
    body: Fragment;
    fallback?: Fragment;
};

export type ExpressionTag = BaseNode & {
    type: "ExpressionTag";
    expression: Expression;
};

export type HtmlTag = BaseNode & {
    type: "HtmlTag";
    expression: Expression;
};

export type Root = BaseNode & {
    type: "Root";
    fragment: Fragment;
    js: any;
    css: any;
};

export type Element = BaseNode & {
    type: "Element";
    attributes: Array<Attribute | Directive>;
    fragment: Fragment;
    name: string;
};

export type SlotElement = BaseNode & {
    type: "SlotElement";
    attributes: Array<Attribute>;
    fragment: Fragment;
    name: string;
};

export type Attribute = BaseNode & {
    type: "Attribute";
    name: string;
    value: true | Array<Text | Expression>;
};

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
    | CallExpression;

export type Property = {
    type: "Property";
    key: Identifier;
    value: Expression;
};

export type ObjectExpression = {
    type: "ObjectExpression";
    properties: Property[];
};

export type ArrayExpression = {
    type: "ArrayExpression";
    elements: Expression[];
};

export type CallExpression = {
    type: "CallExpression";
    name: Identifier | MemberExpression;
    arguments: Expression[];
};

export type FilterExpression = {
    type: "FilterExpression";
    name: Identifier;
    arguments: Expression[];
};

export type MemberExpression = {
    type: "MemberExpression";
    computed: boolean;
    object: Identifier | MemberExpression;
    property: Identifier | MemberExpression;
};

export type NumericLiteral = {
    type: "NumericLiteral";
    value: number;
};

export type BooleanLiteral = {
    type: "BooleanLiteral";
    value: boolean;
    raw: string;
};

export type NullLiteral = {
    type: "NullLiteral";
    value: null;
    raw: string;
};

export type StringLiteral = {
    type: "StringLiteral";
    value: string;
    raw: string;
};

export type BinaryExpression = {
    type: "BinaryExpression";
    left: Expression;
    operator: string;
    right: Expression;
};

export type Identifier = {
    type: "Identifier";
    name: string;
};

export type UnaryExpression = {
    type: "UnaryExpression";
    operator: string;
    argument: Expression;
};

export type ConditionalExpression = {
    type: "ConditionalExpression";
    test: Expression;
    consequent: Expression;
    alternate: Expression;
};

export type Text = BaseNode & {
    type: "Text";
    data: string;
};

export type Variable = BaseNode & {
    type: "Variable";
    name: Identifier | MemberExpression;
    value: Expression;
};
