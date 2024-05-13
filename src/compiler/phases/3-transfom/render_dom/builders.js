/**
 * @param {string} name
 * @returns {import("estree").FunctionDeclaration}
 */
export function fn(name) {
    return {
        type: "FunctionDeclaration",
        params: [],
        id: identifier(name),
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
export function identifier(name) {
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

    return {
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
            {
                type: "VariableDeclarator",
                id: identifier(name),
                init: internal("template", args),
            },
        ],
    };
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
    return call(member(identifier("$"), identifier(method)), args);
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
export function expressionStatement(expression) {
    return {
        type: "ExpressionStatement",
        expression,
    };
}
