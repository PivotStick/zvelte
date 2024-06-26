export type Program = {
    kind: "program";
    children: Array<Class | Namespace>;
    errors: unknown[];
    comments: unknown[];
};

export type Class = {
    kind: "class";
    name: Identifier;
    isAnonymous: boolean;
    extends: null;
    implements: null;
    body: Array<Method>;
    isAbstract: boolean;
    isFinal: boolean;
};

export type Method = {
    kind: "method";
    name: Identifier;
    arguments: Array<Parameter>;
    byref: boolean;
    nullable: boolean;
    body: Block;
    isAbstract: boolean;
    isFinal: boolean;
    visibility: "public";
    isStatic: boolean;
    type?: TypeReference;
};

export type Block = {
    kind: "block";
    children: Array<ExpressionStatement | Return | If | ForEach | Call>;
};

export type Identifier = {
    kind: "identifier";
    name: string;
};

export type Namespace = {
    kind: "namespace";
    name: string;
    withBrackets: boolean;
    children: Array<Class | UseGroup>;
};

export type Parameter = {
    kind: "parameter";
    name: Identifier;
    type?: TypeReference;
    byref: boolean;
    variadic: boolean;
    nullable: boolean;
};

export type TypeReference = {
    kind: "typereference";
    name: string;
    raw: string;
};

export type ExpressionStatement<T extends Expression = Expression> = {
    kind: "expressionstatement";
    expression: T;
};

export type If = {
    kind: "if";
    test: Expression;
    body: Block;
    alternate?: Block;
    shortForm: boolean;
};

export type ForEach = {
    kind: "foreach";
    source: Expression;
    value: Variable;
    key?: Variable;
    body: Block;
    shortForm: boolean;
};

export type Expression =
    | Cast
    | Name
    | Primary
    | Call
    | OffsetLookup
    | StaticLookup
    | PropertyLookup
    | Assign
    | Bin
    | Closure
    | RetIf
    | ArrowFunc;

export type Closure = {
    kind: "closure";
    uses: Array<Variable>;
    arguments: Array<Parameter>;
    byref: boolean;
    nullable: boolean;
    isStatic: boolean;
    body: Block;
    type?: TypeReference;
};

export type RetIf = {
    kind: "retif";
    test: Expression;
    trueExpr: Expression;
    falseExpr: Expression;
};

export type Assign = {
    kind: "assign";
    left: Expression;
    right: Expression;
    operator: "=" | "+=" | "-=";
};

export type Return = {
    kind: "return";
    expr: Expression;
};

export type Call = {
    kind: "call";
    what: Expression;
    arguments: Array<Expression>;
    wrap?: boolean;
};

export type Bin = {
    kind: "bin";
    type: string;
    left: Expression;
    right: Expression;
};

export type Name = {
    kind: "name";
    resolution: "uqn" | "fqn" | "qn";
    name: string;
};

export type OffsetLookup = {
    kind: "offsetlookup";
    what: Expression;
    offset: false | Expression;
};

export type StaticLookup = {
    kind: "staticlookup";
    what: Name;
    offset: Identifier;
};

export type PropertyLookup = {
    kind: "propertylookup";
    what: Expression;
    offset: Identifier | EncapsedPart;
};

export type EncapsedPart = {
    kind: "encapsedpart";
    expression: Expression;
    syntax: "complex";
    curly: boolean;
};

export type Primary =
    | Variable
    | ArrayLiteral
    | Literal
    | Unary
    | Empty
    | Isset
    | Identifier;

export type Empty = {
    kind: "empty";
    expression: Expression;
};

export type Isset = {
    kind: "isset";
    variables: Array<Expression>;
};

export type Unary = {
    kind: "unary";
    type: "!" | "-" | "+";
    what: Expression;
    wrap: boolean;
};

export type Variable = {
    kind: "variable";
    name: string;
    curly: boolean;
    byref?: boolean;
};

export type ArrayLiteral = {
    kind: "array";
    items: Array<Entry>;
    shortForm: boolean;
};

export type Cast = {
    kind: "cast";
    type: string;
    raw: string;
    expr: Expression;
};

export type Entry = {
    kind: "entry";
    key?: Expression;
    value: Expression;
    unpack?: boolean;
};

export type Literal =
    | StringLiteral
    | BooleanLiteral
    | NumberLiteral
    | NullKeyword;

export type StringLiteral = {
    kind: "string";
    value: string;
    raw: string;
    unicode: boolean;
    isDoubleQuote: boolean;
};

export type BooleanLiteral = {
    kind: "boolean";
    value: boolean;
    raw: string;
};

export type NumberLiteral = {
    kind: "number";
    value: number;
    raw: string;
};

export type NullKeyword = {
    kind: "nullkeyword";
    raw: string;
};

export type ArrowFunc = {
    kind: "arrowfunc";
    arguments: Expression[];
    body: Expression;
    isStatic: boolean;
};

export type UseGroup = {
    kind: "usegroup";
    name: string;
    items: UseItem[];
};

export type UseItem = {
    kind: "useitem";
    name: string;
};

export type Node = Literal | Expression | UseGroup | UseItem;
