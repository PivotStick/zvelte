export type Fragment = Element | Text | MustacheTag | IfBlock | ForBlock;

export type IfBlock = {
    type: "IfBlock";
    children: Fragment[];
    elseif: boolean;
    expression: Expression;
    else?: ElseBlock<"if">;
};

export type ForBlock = {
    type: "ForBlock";
    keyVar: null;
    itemVar: string;
    expression: Expression;
    children: Fragment[];
    else?: ElseBlock<"for">;
};

export type ElseBlock<In extends "if" | "for" = "if" | "for"> = {
    type: "ElseBlock";
    in: In;
    children: Fragment[];
};

export type MustacheTag = {
    type: "MustacheTag";
    expression: Expression;
};

export type FragmentRoot = {
    type: "Fragment";
    children: Fragment[];
};

export type Element = {
    type: "Element";
    attributes: Attribute[];
    children: Fragment[];
    name: string;
};

export type Attribute = {
    type: "Attribute";
    modifier: null | string;
    name: string;
    value: (Text | Expression)[] | true;
    start: number;
    end: number;
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

export type Text = {
    type: "Text";
    data: string;
};

export type Variable = {
    type: "Variable";
    name: Identifier | MemberExpression;
    value: Expression;
};
