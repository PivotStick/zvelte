/**
 * @param {string} name
 * @returns {import("estree").FunctionDeclaration}
 */
export function fn(name) {
    return {
        type: "FunctionDeclaration",
        params: [],
        id: id(name),
        body: {
            type: "BlockStatement",
            body: [],
        },
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
 * @param {string} name
 * @param {import("estree").TemplateLiteral} template
 * @returns {import("estree").VariableDeclaration}
 */
export function rootTemplate(name, template, fragment = false) {
    /** @type {import("estree").Expression[]} */
    const args = [template];

    if (fragment) {
        args.push(literal(1));
    }

    return declaration("const", name, internal("template", args));
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
 * @returns {import("estree").TemplateLiteral}
 */
export function templateLiteral() {
    return {
        type: "TemplateLiteral",
        quasis: [],
        expressions: [],
    };
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
 * @param {import("estree").CallExpression["callee"]} callee
 * @param {import("estree").CallExpression["arguments"]} args
 *
 * @returns {import("estree").CallExpression}
 */
export function call(callee, args = []) {
    return {
        type: "CallExpression",
        callee,
        arguments: args,
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
export function internal(method, args = []) {
    return call(member(id("$"), id(method)), args);
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

export { let_builder as let, const_builder as const, var_builder as var };
