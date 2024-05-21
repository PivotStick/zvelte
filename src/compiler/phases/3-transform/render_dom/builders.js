import { sanitizeTemplateString } from "./sanitizeTemplateString.js";

/**
 * @param {Array<import('estree').Pattern>} params
 * @param {import('estree').BlockStatement | import('estree').Expression} body
 * @returns {import('estree').ArrowFunctionExpression}
 */
export function arrow(params, body) {
    return {
        type: "ArrowFunctionExpression",
        params,
        body,
        expression: body.type !== "BlockStatement",
        generator: false,
        async: false,
    };
}

/**
 * @param {import('estree').Expression | import('estree').BlockStatement} expression
 * @param {boolean} [async]
 * @returns {import('estree').Expression}
 */
export function thunk(expression, async = false) {
    if (
        expression.type === "CallExpression" &&
        expression.callee.type !== "Super" &&
        expression.callee.type !== "MemberExpression" &&
        expression.callee.type !== "CallExpression" &&
        expression.arguments.length === 0
    ) {
        return expression.callee;
    }

    const fn = arrow([], expression);
    if (async) fn.async = true;
    return fn;
}

/**
 * @param {import('estree').TemplateElement[]} elements
 * @param {import('estree').Expression[]} expressions
 * @returns {import('estree').TemplateLiteral}
 */
export function template(elements, expressions) {
    return { type: "TemplateLiteral", quasis: elements, expressions };
}

/**
 * @param {string} cooked
 * @param {boolean} tail
 * @returns {import('estree').TemplateElement}
 */
export function quasi(cooked, tail = false) {
    const raw = sanitizeTemplateString(cooked);
    return { type: "TemplateElement", value: { raw, cooked }, tail };
}

/**
 * @param {string} as
 * @param {string} source
 * @returns {import('estree').ImportDeclaration}
 */
export function importAll(as, source) {
    return {
        type: "ImportDeclaration",
        source: literal(source),
        specifiers: [importNamespace(as)],
    };
}

/**
 * @param {string} local
 * @returns {import('estree').ImportNamespaceSpecifier}
 */
function importNamespace(local) {
    return {
        type: "ImportNamespaceSpecifier",
        local: id(local),
    };
}

/**
 * @param {import('estree').Expression | import('estree').MaybeNamedClassDeclaration | import('estree').MaybeNamedFunctionDeclaration} declaration
 * @returns {import('estree').ExportDefaultDeclaration}
 */
export function exportDefault(declaration) {
    return { type: "ExportDefaultDeclaration", declaration };
}

/**
 * @param {import('estree').Statement[]} body
 * @returns {import('estree').BlockStatement}
 */
export function block(body) {
    return { type: "BlockStatement", body };
}

/**
 * @param {import('estree').Identifier} id
 * @param {import('estree').Pattern[]} params
 * @param {import('estree').BlockStatement} body
 * @returns {import('estree').FunctionDeclaration}
 */
export function fn(id, params, body) {
    return {
        type: "FunctionDeclaration",
        id,
        params,
        body,
        generator: false,
        async: false,
    };
}

/**
 * @param {string} name
 * @returns {import("estree").Identifier}
 */
export function id(name) {
    return {
        type: "Identifier",
        name,
    };
}

/**
 * @param {'const' | 'let' | 'var'} kind
 * @param {string | import('estree').Pattern} pattern
 * @param {import('estree').Expression} [init]
 * @returns {import('estree').VariableDeclaration}
 */
export function declaration(kind, pattern, init) {
    if (typeof pattern === "string") pattern = id(pattern);

    return {
        type: "VariableDeclaration",
        kind,
        declarations: [init ? declarator(pattern, init) : declarator(pattern)],
    };
}

/**
 * @param {import('estree').Pattern} id
 * @param {import('estree').Expression} [init]
 * @returns {import('estree').VariableDeclarator}
 */
export function declarator(id, init) {
    return { type: "VariableDeclarator", id, init };
}

/**
 * @param {string} value
 * @returns {import("estree").Literal}
 */
export function string(value) {
    return {
        type: "Literal",
        value,
    };
}

/**
 * @returns {import("estree").TemplateElement}
 */
export function templateElement() {
    return {
        type: "TemplateElement",
        tail: true,
        value: {
            raw: "",
        },
    };
}

/**
 * @param {string | import('estree').Expression} callee
 * @param {...(import('estree').Expression | import('estree').SpreadElement | false | undefined)} args
 * @returns {import('estree').CallExpression}
 */
export function call(callee, ...args) {
    if (typeof callee === "string") callee = id(callee);
    args = args.slice();

    // replacing missing arguments with `undefined`, unless they're at the end in which case remove them
    let i = args.length;
    let popping = true;
    while (i--) {
        if (!args[i]) {
            if (popping) {
                args.pop();
            } else {
                args[i] = id("undefined");
            }
        } else {
            popping = false;
        }
    }

    return {
        type: "CallExpression",
        callee,
        arguments:
            /** @type {Array<import('estree').Expression | import('estree').SpreadElement>} */ (
                args
            ),
        optional: false,
    };
}

/**
 * @param {import('estree').Expression | import('estree').Super} object
 * @param {import('estree').Expression | import('estree').PrivateIdentifier} property
 * @param {boolean} computed
 * @param {boolean} optional
 * @returns {import('estree').MemberExpression}
 */
export function member(object, property, computed = false, optional = false) {
    return {
        type: "MemberExpression",
        object,
        property,
        computed,
        optional,
    };
}

/**
 * @param {string} method
 * @param {import("estree").CallExpression["arguments"]} args
 *
 * @returns {import("estree").CallExpression}
 */
export function internal(method, ...args) {
    return call(`$.${method}`, ...args);
}

/**
 * @param {string | boolean | null | number | RegExp} value
 * @returns {import('estree').Literal}
 */
export function literal(value) {
    // @ts-expect-error we don't want to muck around with bigint here
    return { type: "Literal", value };
}

/**
 * @param {import("estree").Expression} expression
 * @returns {import("estree").ExpressionStatement}
 */
export function stmt(expression) {
    return {
        type: "ExpressionStatement",
        expression,
    };
}

/**
 * @param {Array<import('estree').Property | import('estree').SpreadElement>} properties
 * @returns {import('estree').ObjectExpression}
 */
export function object(properties) {
    return { type: "ObjectExpression", properties };
}

/**
 * @param {string | import('estree').Pattern} pattern
 * @param { import('estree').Expression} [init]
 * @returns {import('estree').VariableDeclaration}
 */
function let_builder(pattern, init) {
    return declaration("let", pattern, init);
}

/**
 * @param {string | import('estree').Pattern} pattern
 * @param { import('estree').Expression} init
 * @returns {import('estree').VariableDeclaration}
 */
function const_builder(pattern, init) {
    return declaration("const", pattern, init);
}

/**
 * @param {string | import('estree').Pattern} pattern
 * @param { import('estree').Expression} [init]
 * @returns {import('estree').VariableDeclaration}
 */
function var_builder(pattern, init) {
    return declaration("var", pattern, init);
}

const true_instance = literal(true);
const false_instance = literal(false);

export {
    let_builder as let,
    const_builder as const,
    var_builder as var,
    true_instance as true,
    false_instance as false,
};
