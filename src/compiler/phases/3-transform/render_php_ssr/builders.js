/**
 * @param {import("./type.js").Program["children"]} children
 *
 * @returns {import("./type.js").Program}
 */
export function program(children) {
    return {
        kind: "program",
        children,
        comments: [],
        errors: [],
    };
}

/**
 * @param {string} name
 * @param {import("./type.js").Class["body"]} body
 *
 * @returns {import("./type.js").Class}
 */
export function declareClass(name, body = []) {
    return {
        kind: "class",
        name: identifier(name),
        isAbstract: false,
        body,
        isAnonymous: false,
        extends: null,
        isFinal: false,
        implements: null,
    };
}

/**
 * @param {string} name
 *
 * @returns {import("./type.js").Identifier}
 */
export function identifier(name) {
    return {
        kind: "identifier",
        name,
    };
}

/**
 * @param {string} name
 * @param {string=} returnType
 *
 * @returns {import("./type.js").Method}
 */
export function method(name, returnType) {
    return {
        kind: "method",
        nullable: false,
        visibility: "public",
        name: identifier(name),
        byref: false,
        isFinal: false,
        body: block(),
        isAbstract: false,
        isStatic: false,
        arguments: [],
        type: returnType ? typeReference(returnType) : undefined,
    };
}

/**
 * @param {string} name
 *
 * @returns {import("./type.js").TypeReference}
 */
export function typeReference(name) {
    return {
        kind: "typereference",
        name,
        raw: name,
    };
}

/**
 * @returns {import("./type.js").Block}
 */
export function block() {
    return {
        kind: "block",
        children: [],
    };
}

/**
 * @param {string} name
 * @param {import("./type.js").Namespace["children"]} children
 *
 * @returns {import("./type.js").Namespace}
 */
export function namespace(name, children = []) {
    return {
        kind: "namespace",
        withBrackets: false,
        children,
        name,
    };
}

/**
 * @param {string} name
 * @param {string=} type
 *
 * @returns {import("./type.js").Parameter}
 */
export function parameter(name, type, byref = false) {
    return {
        kind: "parameter",
        byref,
        name: identifier(name),
        type: type ? typeReference(type) : undefined,
        nullable: false,
        variadic: false,
    };
}

/**
 * @param {string} name
 *
 * @returns {import("./type.js").Variable}
 */
export function variable(name, byref = false) {
    return {
        kind: "variable",
        name,
        curly: false,
        byref,
    };
}

/**
 * @param {import("./type.js").ArrayLiteral["items"]} items
 *
 * @returns {import("./type.js").ArrayLiteral}
 */
export function array(items = []) {
    return {
        kind: "array",
        items,
        shortForm: true,
    };
}

/**
 * @param {Record<string, import("./type.js").Expression>} o
 *
 * @returns {import("./type.js").ArrayLiteral}
 */
export function arrayFromObject(o) {
    /** @type {import("./type.js").Entry[]} */
    const entries = [];

    Object.entries(o).forEach(([key, value]) => {
        entries.push(entry(value, string(key)));
    });

    return array(entries);
}

/**
 * @param {import("./type.js").Assign["left"]} left
 * @param {import("./type.js").Assign["operator"]} operator
 * @param {import("./type.js").Assign["right"]} right
 *
 * @returns {import("./type.js").ExpressionStatement<import("./type.js").Assign>}
 */
export function assign(left, operator, right) {
    return statement({
        kind: "assign",
        left,
        operator,
        right,
    });
}

/**
 * @template {import("./type.js").Expression} T
 *
 * @param {T} expression
 * @returns {import("./type.js").ExpressionStatement<T>}
 */
export function statement(expression) {
    return {
        kind: "expressionstatement",
        expression,
    };
}

/**
 * @param {import("./type.js").Return["expr"]} expression
 * @returns {import("./type.js").Return}
 */
export function returnExpression(expression) {
    return {
        kind: "return",
        expr: expression,
    };
}

/**
 * @param {import("./type.js").Call["what"]} what
 * @param {import("./type.js").Call["arguments"]} args
 * @returns {import("./type.js").Call}
 */
export function call(what, args = [], wrap = false) {
    return {
        kind: "call",
        what,
        arguments: args,
        wrap,
    };
}

/**
 * @param {string} name
 * @returns {import("./type.js").Name}
 */
export function name(name) {
    return {
        kind: "name",
        name,
        resolution: name.startsWith("\\")
            ? "fqn"
            : name.includes("\\")
              ? "qn"
              : "uqn",
    };
}

/**
 * @param {import("./type.js").StaticLookup["what"]} what
 * @param {string} name
 *
 * @returns {import("./type.js").StaticLookup}
 */
export function staticLookup(what, name) {
    return {
        kind: "staticlookup",
        what,
        offset: identifier(name),
    };
}

/**
 * @param {string | number | boolean | null} value
 *
 * @returns {import("./type.js").StringLiteral
 *  | import("./type.js").NumberLiteral
 *  | import("./type.js").BooleanLiteral
 *  | import("./type.js").NullKeyword
 * }
 */
export function literal(value) {
    if (value === null) {
        return nullKeyword();
    }

    if (typeof value === "string") {
        return string(value);
    }

    if (typeof value === "number") {
        return number(value);
    }

    if (typeof value === "boolean") {
        return boolean(value);
    }

    throw new Error(`${typeof value} is not a literal`);
}

/** @returns {import("./type.js").NullKeyword} */
export function nullKeyword() {
    return {
        kind: "nullkeyword",
        raw: "null",
    };
}

/**
 * @param {string} value
 * @returns {import("./type.js").StringLiteral} */
export function string(value) {
    return {
        kind: "string",
        value: value.replace(/'/g, "\\'"),
        raw: `'${value}'`,
        unicode: false,
        isDoubleQuote: false,
    };
}

/**
 * @param {number} value
 * @returns {import("./type.js").NumberLiteral} */
export function number(value) {
    return {
        kind: "number",
        value,
        raw: String(value),
    };
}

/**
 * @param {boolean} value
 * @returns {import("./type.js").BooleanLiteral}
 */
export function boolean(value) {
    return {
        kind: "boolean",
        value,
        raw: String(value),
    };
}

/**
 * @param {import("./type.js").OffsetLookup["what"]} what
 * @param {import("./type.js").OffsetLookup["offset"]} offset
 *
 * @returns {import("./type.js").OffsetLookup}
 */
export function offsetLookup(what, offset = false) {
    return {
        kind: "offsetlookup",
        what,
        offset,
    };
}

/**
 * @param {import("./type.js").PropertyLookup["what"]} what
 * @param {import("./type.js").PropertyLookup["offset"]} offset
 * @returns {import("./type.js").PropertyLookup}
 */
export function propertyLookup(what, offset) {
    return {
        kind: "propertylookup",
        what,
        offset,
    };
}

/**
 * @param {import("./type.js").EncapsedPart["expression"]} expression
 *
 * @returns {import("./type.js").EncapsedPart}
 */
export function encapsedPart(expression) {
    return {
        kind: "encapsedpart",
        expression,
        curly: true,
        syntax: "complex",
    };
}

/**
 * @param {import("./type.js").Bin["left"]} left
 * @param {import("./type.js").Bin["type"]} operator
 * @param {import("./type.js").Bin["right"]} right
 * @returns {import("./type.js").Bin}
 */
export function bin(left, operator, right) {
    return {
        kind: "bin",
        type: operator,
        left,
        right,
    };
}

/**
 * @param {import("./type.js").If["test"]} test
 * @param {import("./type.js").If["body"]=} consequent
 * @param {import("./type.js").If["alternate"]=} alternate
 * @returns {import("./type.js").If}
 */
export function ifStatement(test, consequent = block(), alternate = undefined) {
    return {
        kind: "if",
        shortForm: false,
        test,
        body: consequent,
        alternate,
    };
}

/**
 * @param {import("./type.js").RetIf["test"]} test
 * @param {import("./type.js").RetIf["trueExpr"]} consequent
 * @param {import("./type.js").RetIf["falseExpr"]} alternate
 *
 * @returns {import("./type.js").RetIf}
 */
export function ternary(test, consequent, alternate) {
    return {
        kind: "retif",
        test,
        trueExpr: consequent,
        falseExpr: alternate,
    };
}

/**
 * @param {Map<import("./type.js").Expression, import("./type.js").Expression>} map
 * @returns {import("./type.js").Cast}
 */
export function object(map) {
    const entries = Array.from(map.entries());

    return cast(
        array(entries.map(([key, value]) => entry(value, key))),
        "object",
    );
}

/**
 * @param {Record<string, import("./type.js").Expression>} o
 * @returns {import("./type.js").Cast}
 */
export function objectFromLiteral(o) {
    /**
     * @type {Parameters<typeof object>[0]}
     */
    const map = new Map();

    Object.entries(o).forEach(([key, expression]) => {
        map.set(string(key), expression);
    });

    return object(map);
}

/**
 * @param {import("./type.js").Entry["value"]} value
 * @param {import("./type.js").Entry["key"]=} key
 *
 * @returns {import("./type.js").Entry}
 */
export function entry(value, key, unpack = false) {
    return {
        kind: "entry",
        value,
        key,
        unpack,
    };
}

/**
 * @param {(string | import("./type.js").Expression)[]} template
 */
export function sprintf(template) {
    let format = "";
    const args = [];

    for (let i = 0; i < template.length; i++) {
        const value = template[i];

        if (typeof value === "string") {
            format += value;
        } else {
            format += "%s";
            args.push(value);
        }
    }

    return call(name("sprintf"), [string(format), ...args]);
}

/**
 * @param {import("./type.js").ForEach["source"]} source
 * @param {import("./type.js").ForEach["value"]} value
 * @param {import("./type.js").ForEach["key"]=} key
 * @returns {import("./type.js").ForEach}
 */
export function forEach(source, value, key) {
    return {
        kind: "foreach",
        source,
        value,
        key,
        body: block(),
        shortForm: false,
    };
}

/**
 * @param {import("./type.js").Empty["expression"]} expression
 * @returns {import("./type.js").Empty}
 */
export function empty(expression) {
    return {
        kind: "empty",
        expression,
    };
}

/**
 * @param {import("./type.js").Isset["variables"]} variables
 * @returns {import("./type.js").Isset}
 */
export function isset(...variables) {
    return {
        kind: "isset",
        variables,
    };
}

/**
 * @param {import("./type.js").Unary["type"]} type
 * @param {import("./type.js").Unary["what"]} what
 * @returns {import("./type.js").Unary}
 */
export function unary(type, what, wrap = false) {
    return {
        kind: "unary",
        type,
        what,
        wrap,
    };
}

/**
 * @param {import("./type.js").Closure["arguments"]} args
 * @param {import("./type.js").Closure["isStatic"]} isStatic
 * @param {import("./type.js").Closure["uses"]} uses
 * @param {string=} type
 *
 * @returns {import("./type.js").Closure}
 */
export function closure(
    isStatic = false,
    args = [],
    uses = [],
    type = undefined,
) {
    return {
        kind: "closure",
        body: block(),
        nullable: false,
        isStatic: isStatic,
        arguments: args,
        byref: false,
        uses,
        type: type ? typeReference(type) : undefined,
    };
}

/**
 * @param {import("./type.js").Cast["expr"]} expr
 * @param {import("./type.js").Cast["type"]} type
 * @returns {import("./type.js").Cast}
 */
export function cast(expr, type) {
    return {
        kind: "cast",
        expr,
        type,
        raw: `(${type})`,
    };
}
