/** @import * as PHP from "./types.js" */

/**
 * @param {PHP.Expression} expr
 *
 * @returns {PHP.Silent}
 */
export function silent(expr) {
    return {
        kind: "silent",
        expr,
    };
}

/**
 * @param {PHP.Program["children"]} children
 *
 * @returns {PHP.Program}
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
 * @param {PHP.Class["body"]} body
 *
 * @returns {PHP.Class}
 */
export function declareClass(name, body = []) {
    return {
        kind: "class",
        name: id(name),
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
 * @returns {PHP.Identifier}
 */
export function id(name) {
    return {
        kind: "identifier",
        name,
    };
}

/**
 * @param {string} name
 * @param {string=} returnType
 *
 * @returns {PHP.Method}
 */
export function method(name, returnType) {
    return {
        kind: "method",
        nullable: false,
        visibility: "public",
        name: id(name),
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
 * @returns {PHP.TypeReference}
 */
export function typeReference(name) {
    return {
        kind: "typereference",
        name,
        raw: name,
    };
}

/**
 * @param {PHP.Block["children"]} [children=[]]
 * @returns {PHP.Block}
 */
export function block(children = []) {
    return {
        kind: "block",
        children,
    };
}

/**
 * @param {string} name
 * @param {PHP.Namespace["children"]} children
 *
 * @returns {PHP.Namespace}
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
 * @returns {PHP.Parameter}
 */
export function parameter(name, type, byref = false) {
    return {
        kind: "parameter",
        byref,
        name: id(name),
        type: type ? typeReference(type) : undefined,
        nullable: false,
        variadic: false,
    };
}

/**
 * @param {string} name
 *
 * @returns {PHP.Variable}
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
 * @param {PHP.ArrayLiteral["items"]} items
 *
 * @returns {PHP.ArrayLiteral}
 */
export function array(items = []) {
    return {
        kind: "array",
        items,
        shortForm: true,
    };
}

/**
 * @param {Record<string, PHP.Expression>} o
 *
 * @returns {PHP.ArrayLiteral}
 */
export function arrayFromObject(o) {
    /** @type {PHP.Entry[]} */
    const entries = [];

    Object.entries(o).forEach(([key, value]) => {
        entries.push(entry(value, string(key)));
    });

    return array(entries);
}

/**
 * @param {PHP.Assign["left"]} left
 * @param {PHP.Assign["operator"]} operator
 * @param {PHP.Assign["right"]} right
 *
 * @returns {PHP.Statement<PHP.Assign>}
 */
export function assign(left, operator, right) {
    return stmt({
        kind: "assign",
        left,
        operator,
        right,
    });
}

/**
 * @param {PHP.Post["type"]} type
 * @param {PHP.Post["what"]} what
 * @returns {PHP.Post}
 */
export function post(type, what) {
    return {
        kind: "post",
        type,
        what,
    };
}

/**
 * @param {PHP.Pre["type"]} type
 * @param {PHP.Pre["what"]} what
 * @returns {PHP.Pre}
 */
export function pre(type, what) {
    return {
        kind: "pre",
        type,
        what,
    };
}

/**
 * @param {PHP.Expression} expression
 *
 * @returns {PHP.ExpressionStatement}
 */
export function stmt(expression) {
    return {
        kind: "expressionstatement",
        expression,
    };
}

/**
 * @param {PHP.Return["expr"]} expression
 * @returns {PHP.Return}
 */
export function returnExpression(expression) {
    return {
        kind: "return",
        expr: expression,
    };
}

/**
 * @param {PHP.Call["what"] | string} what
 * @param {PHP.Call["arguments"]} args
 * @returns {PHP.Call}
 */
export function call(what, args = [], wrap = false) {
    return {
        kind: "call",
        what: typeof what === "string" ? id(what) : what,
        arguments: args,
        wrap,
    };
}

/**
 * @param {PHP.Expression | string} what
 * @param {PHP.Expression[]} args
 * @returns {PHP.If}
 */
export function maybe_call(what, args = [], wrap = false) {
    what = typeof what === "string" ? id(what) : what;

    return if_statement(call("is_callable", [what]), call(what, args, wrap));
}

/**
 * @param {string} name
 * @returns {PHP.Name}
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
 * @param {PHP.StaticLookup["what"]} what
 * @param {string} name
 *
 * @returns {PHP.StaticLookup}
 */
export function staticLookup(what, name) {
    return {
        kind: "staticlookup",
        what,
        offset: id(name),
    };
}

/**
 * @param {string | number | boolean | null} value
 *
 * @returns {PHP.StringLiteral
 *  | PHP.NumberLiteral
 *  | PHP.BooleanLiteral
 *  | PHP.NullKeyword
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

/** @returns {PHP.NullKeyword} */
export function nullKeyword() {
    return {
        kind: "nullkeyword",
        raw: "null",
    };
}

/**
 * @param {string} value
 * @returns {PHP.StringLiteral} */
export function string(value) {
    return {
        kind: "string",
        value: value,
        raw: `'${value}'`,
        unicode: false,
        isDoubleQuote: false,
    };
}

/**
 * @param {number} value
 * @returns {PHP.NumberLiteral} */
export function number(value) {
    return {
        kind: "number",
        value,
        raw: String(value),
    };
}

/**
 * @param {boolean} value
 * @returns {PHP.BooleanLiteral}
 */
export function boolean(value) {
    return {
        kind: "boolean",
        value,
        raw: String(value),
    };
}

/**
 * @param {PHP.OffsetLookup["what"]} what
 * @param {PHP.OffsetLookup["offset"]} offset
 *
 * @returns {PHP.OffsetLookup}
 */
export function offsetLookup(what, offset = false) {
    return {
        kind: "offsetlookup",
        what,
        offset,
    };
}

/**
 * @param {PHP.PropertyLookup["what"]} what
 * @param {PHP.PropertyLookup["offset"]} offset
 * @param {PHP.PropertyLookup["optional"]} optional
 * @returns {PHP.PropertyLookup}
 */
export function propertyLookup(what, offset, optional = false) {
    return {
        kind: "propertylookup",
        what,
        offset,
        optional,
    };
}

/**
 * @param {PHP.EncapsedPart["expression"] | string} expression
 *
 * @returns {PHP.EncapsedPart}
 */
export function encapsedPart(expression) {
    if (typeof expression === "string") {
        return {
            kind: "encapsedpart",
            expression: string(expression),
            curly: false,
            syntax: null,
        };
    }

    return {
        kind: "encapsedpart",
        expression,
        curly: true,
        syntax: "complex",
    };
}

/**
 * @param {PHP.Template['quasis']} elements
 * @param {PHP.Template['expressions']} expressions
 *
 * @returns {PHP.Template}
 */
export function template(elements, expressions) {
    return {
        kind: "template",
        quasis: elements,
        expressions,
    };
}

/**
 * @param {string} cooked
 * @param {boolean} tail
 *
 * @returns {PHP.TemplateElement}
 */
export function quasi(cooked, tail = false) {
    const raw = cooked.replace(/('|\${|\\)/g, "\\$1");
    return { kind: "templateelement", value: { raw, cooked }, tail };
}

/**
 * @param {PHP.EncapsedPart[]} parts
 *
 * @returns {PHP.Encapsed}
 */
export function encapsed(parts) {
    return {
        kind: "encapsed",
        value: parts,
    };
}

/**
 * @param {PHP.Bin["left"]} left
 * @param {PHP.Bin["type"]} operator
 * @param {PHP.Bin["right"]} right
 * @returns {PHP.Bin}
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
 * @param {PHP.If["test"]} test
 * @param {PHP.If["body"]=} consequent
 * @param {PHP.If["alternate"]=} alternate
 * @returns {PHP.If}
 */
function if_statement(test, consequent = block(), alternate = undefined) {
    return {
        kind: "if",
        shortForm: false,
        test,
        body: consequent,
        alternate,
    };
}

/**
 * @param {PHP.RetIf["test"]} test
 * @param {PHP.RetIf["trueExpr"]} consequent
 * @param {PHP.RetIf["falseExpr"]} alternate
 *
 * @returns {PHP.RetIf}
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
 * @param {Map<PHP.Expression, PHP.Expression> | PHP.Entry[]} map
 * @returns {PHP.Cast}
 */
export function object(map = new Map()) {
    if (map instanceof Array) {
        return cast(array(map), "object");
    }

    const entries = Array.from(map.entries());

    return cast(
        array(entries.map(([key, value]) => entry(value, key))),
        "object",
    );
}

/**
 * @param {Record<string, PHP.Expression>} o
 * @returns {PHP.Cast}
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
 * @param {PHP.Entry["key"] | undefined | string} key
 * @param {PHP.Entry["value"]} value
 *
 * @returns {PHP.Entry}
 */
export function entry(key, value, unpack = false) {
    return {
        kind: "entry",
        value,
        key: typeof key === "string" ? string(key) : key,
        unpack,
    };
}

/**
 * @param {(string | PHP.Expression)[]} template
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
 * @param {PHP.ForEach["source"]} source
 * @param {PHP.ForEach["value"]} value
 * @param {PHP.ForEach["key"]=} key
 * @returns {PHP.ForEach}
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
 * @param {PHP.Expression | PHP.Expression[]} init
 * @param {PHP.Expression | PHP.Expression[]} test
 * @param {PHP.Expression | PHP.Expression[]} increment
 * @param {PHP.Statement[]} body
 *
 * @returns {PHP.For}
 */
function for_statement(init, test, increment, body = []) {
    return {
        kind: "for",
        init: init instanceof Array ? init : [init],
        test: test instanceof Array ? test : [test],
        increment: increment instanceof Array ? increment : [increment],
        body: block(body),
        shortForm: false,
    };
}

/**
 * @param {PHP.Empty["expression"]} expression
 * @returns {PHP.Empty}
 */
export function empty(expression) {
    return {
        kind: "empty",
        expression,
    };
}

/**
 * @param {PHP.Isset["variables"]} variables
 * @returns {PHP.Isset}
 */
export function isset(...variables) {
    return {
        kind: "isset",
        variables,
    };
}

/**
 * @param {PHP.Unary["type"]} type
 * @param {PHP.Unary["what"]} what
 * @returns {PHP.Unary}
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
 * @param {PHP.Closure["arguments"]} args
 * @param {PHP.Closure["isStatic"]} isStatic
 * @param {PHP.Closure["uses"]} uses
 * @param {string=} type
 *
 * @returns {PHP.Closure}
 */
export function closure(
    isStatic = false,
    args = [],
    uses = [],
    body = block(),
    type = undefined,
) {
    return {
        kind: "closure",
        body,
        nullable: false,
        isStatic: isStatic,
        arguments: args,
        byref: false,
        uses,
        type: type ? typeReference(type) : undefined,
    };
}

/**
 * @param {PHP.Cast["expr"]} expr
 * @param {PHP.Cast["type"]} type
 * @returns {PHP.Cast}
 */
export function cast(expr, type) {
    return {
        kind: "cast",
        expr,
        type,
        raw: `(${type})`,
    };
}

/**
 * @param {PHP.ArrowFunc["arguments"]} args
 * @param {PHP.ArrowFunc["body"]} body
 *
 * @returns {PHP.ArrowFunc}
 */
export function arrow(args, body) {
    return {
        kind: "arrowfunc",
        body,
        isStatic: true,
        arguments: args,
    };
}

/**
 * @param {PHP.Expression} body
 *
 * @returns {PHP.ArrowFunc}
 */
export function thunk(body) {
    return arrow([], body);
}

/**
 * @param {string} name
 * @param {...string} items
 *
 * @returns {PHP.UseGroup}
 */
export function use(name, ...items) {
    return {
        kind: "usegroup",
        name,
        items: items.map((name) => ({ kind: "useitem", name, alias: null })),
    };
}

/**
 * @param {string} name
 * @param {string | null} [alias=null]
 *
 * @returns {PHP.UseGroup}
 */
export function useitem(name, alias = null) {
    return {
        kind: "usegroup",
        name: null,
        items: [
            {
                kind: "useitem",
                name,
                alias: alias ? id(alias) : null,
            },
        ],
    };
}

/**
 * @param {string} what
 * @param {...PHP.Expression} args
 *
 * @returns {PHP.New}
 */
function new_builder(what, ...args) {
    return {
        kind: "new",
        what: name(what),
        arguments: args,
    };
}

const true_instance = boolean(true);
const false_instance = boolean(false);

export {
    true_instance as true,
    false_instance as false,
    new_builder as new,
    if_statement as if,
    for_statement as for,
};
