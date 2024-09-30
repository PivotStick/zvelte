import { sanitizeTemplateString } from "./sanitizeTemplateString.js";

/**
 * @template {import('estree').Expression} Value
 * @param {'init' | 'get' | 'set'} kind
 * @param {import('estree').Expression | string} key
 * @param {Value} value
 * @param {boolean} computed
 * @returns {import('estree').Property & { value: Value }}
 */
export function prop(kind, key, value, computed = false) {
    return {
        type: "Property",
        kind,
        key: typeof key === "string" ? id(key) : key,
        value,
        method: false,
        shorthand: false,
        computed,
    };
}

/**
 * @param {import('estree').Pattern} argument
 * @returns {import('estree').RestElement}
 */
export function rest(argument) {
    return { type: "RestElement", argument };
}

/**
 * @param {import('estree').SpreadElement["argument"]} argument
 * @returns {import('estree').SpreadElement}
 */
export function spread(argument) {
    return { type: "SpreadElement", argument };
}

/**
 * @param {import('estree').AssignmentOperator} operator
 * @param {import('estree').Pattern} left
 * @param {import('estree').Expression} right
 * @returns {import('estree').AssignmentExpression}
 */
export function assignment(operator, left, right) {
    return { type: "AssignmentExpression", operator, left, right };
}

/**
 * @param {Array<import('estree').Expression | import('estree').SpreadElement | null>} elements
 * @returns {import('estree').ArrayExpression}
 */
export function array(elements = []) {
    return { type: "ArrayExpression", elements };
}

/**
 * @param {import('estree').Expression} left
 * @param {import('estree').BinaryOperator} operator
 * @param {import('estree').Expression} right
 * @returns {import('estree').BinaryExpression}
 */
export function binary(left, operator, right) {
    return { type: "BinaryExpression", operator, left, right };
}

/**
 * @param {import('estree').Expression} left
 * @param {import('estree').LogicalOperator} operator
 * @param {import('estree').Expression} right
 * @returns {import('estree').LogicalExpression}
 */
export function logical(left, operator, right) {
    return { type: "LogicalExpression", operator, left, right };
}

/**
 * @param {import('estree').UnaryOperator} operator
 * @param {import('estree').Expression} argument
 * @returns {import('estree').UnaryExpression}
 */
export function unary(operator, argument) {
    return { type: "UnaryExpression", argument, operator, prefix: true };
}

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
        // @ts-ignore
        metadata: /** @type {any} */ (null), // should not be used by codegen
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
 * Replace "(arg) => func(arg)" to "func"
 * @param {import('estree').Expression} expression
 * @returns {import('estree').Expression}
 */
export function unthunk(expression) {
    if (
        expression.type === "ArrowFunctionExpression" &&
        expression.async === false &&
        expression.body.type === "CallExpression" &&
        expression.body.callee.type === "Identifier" &&
        expression.params.length === expression.body.arguments.length &&
        expression.params.every((param, index) => {
            const arg = /** @type {import('estree').SimpleCallExpression} */ (
                expression.body
            ).arguments[index];
            return (
                param.type === "Identifier" &&
                arg.type === "Identifier" &&
                param.name === arg.name
            );
        })
    ) {
        return expression.body.callee;
    }
    return expression;
}

/**
 * @param {import('estree').Expression} test
 * @param {import('estree').Expression} consequent
 * @param {import('estree').Expression} alternate
 * @returns {import('estree').ConditionalExpression}
 */
export function conditional(test, consequent, alternate) {
    return { type: "ConditionalExpression", test, consequent, alternate };
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
    return import_builder(source, importNamespace(as));
}

/**
 * @param {string} name
 * @param {string} source
 * @returns {import('estree').ImportDeclaration}
 */
export function importDefault(name, source) {
    return import_builder(source, {
        type: "ImportDefaultSpecifier",
        local: id(name),
    });
}

/**
 * @param {string} source
 * @param {import('estree').ImportDeclaration["specifiers"]} specifiers
 * @returns {import('estree').ImportDeclaration}
 */
function import_builder(source, ...specifiers) {
    return {
        type: "ImportDeclaration",
        source: literal(source),
        specifiers,
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
 * @param {import("estree").ExportNamedDeclaration["declaration"]=} declaration
 * @returns {import('estree').ExportNamedDeclaration}
 */
export function exportNamed(declaration) {
    return {
        type: "ExportNamedDeclaration",
        declaration,
        specifiers: [],
    };
}

/**
 * @param {Record<string, import("estree").Identifier>} specifiers
 * @returns {import('estree').ExportNamedDeclaration}
 */
export function exportSpecifiers(specifiers) {
    /**
     * @type {import("estree").ExportSpecifier[]}
     */
    const mapped = [];

    for (const key in specifiers) {
        if (specifiers.hasOwnProperty(key)) {
            const exported = specifiers[key];

            mapped.push({
                type: "ExportSpecifier",
                local: id(key),
                exported,
            });
        }
    }

    return {
        type: "ExportNamedDeclaration",
        declaration: null,
        specifiers: mapped,
    };
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
export function function_declaration(id, params, body) {
    return {
        type: "FunctionDeclaration",
        id,
        params,
        body,
        generator: false,
        async: false,
        // @ts-ignore
        metadata: /** @type {any} */ (null), // should not be used by codegen
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
export function templateElement(raw = "", tail = true) {
    return {
        type: "TemplateElement",
        tail,
        value: {
            raw,
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
        optional: false,
        arguments:
            /** @type {Array<import('estree').Expression | import('estree').SpreadElement>} */ (
                args
            ),
    };
}

/**
 * @param {string | import('estree').Expression} callee
 * @param {...(import('estree').Expression | import('estree').SpreadElement | false | undefined)} args
 * @returns {import('estree').CallExpression}
 */
export function optionalCall(callee, ...args) {
    const expr = call(callee, ...args);
    // @ts-ignore
    expr.optional = true;
    return expr;
}

/**
 * @param {import('estree').Expression | import('estree').Super} object
 * @param {import('estree').Expression | import('estree').PrivateIdentifier | string} property
 * @param {boolean} computed
 * @param {boolean} optional
 * @returns {import('estree').MemberExpression}
 */
export function member(object, property, computed = false, optional = false) {
    return {
        type: "MemberExpression",
        object,
        property: typeof property === "string" ? id(property) : property,
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

/**
 *
 * @param {import('estree').Identifier | null} id
 * @param {import('estree').Pattern[]} params
 * @param {import('estree').BlockStatement} body
 * @returns {import('estree').FunctionExpression}
 */
function function_builder(id, params, body) {
    return {
        type: "FunctionExpression",
        id,
        params,
        body,
        generator: false,
        async: false,
        // @ts-ignore
        metadata: /** @type {any} */ (null), // should not be used by codegen
    };
}

/**
 * @param {import('estree').Expression | null} argument
 * @returns {import('estree').ReturnStatement}
 */
function return_builder(argument = null) {
    return { type: "ReturnStatement", argument };
}

/**
 * @param {import('estree').Expression[]} expressions
 * @returns {import('estree').SequenceExpression}
 */
export function sequence(expressions) {
    return { type: "SequenceExpression", expressions };
}

/**
 * @param {import('estree').NewExpression['callee'] | string} callee
 * @param {...import('estree').NewExpression['arguments'][number]} args
 * @returns {import('estree').NewExpression}
 */
function new_builder(callee, ...args) {
    return {
        type: "NewExpression",
        callee: typeof callee === "string" ? id(callee) : callee,
        arguments: args,
    };
}

/**
 * @param {import('estree').Expression} test
 * @param {import('estree').Statement} consequent
 * @param {import('estree').Statement} [alternate]
 * @returns {import('estree').IfStatement}
 */
function if_builder(test, consequent, alternate) {
    return { type: "IfStatement", test, consequent, alternate };
}

const true_instance = literal(true);
const false_instance = literal(false);

/** @type {import('estree').ThisExpression} */
const this_instance = {
    type: "ThisExpression",
};

/** @type {import('estree').EmptyStatement} */
export const empty = {
    type: "EmptyStatement",
};

export {
    let_builder as let,
    const_builder as const,
    var_builder as var,
    true_instance as true,
    false_instance as false,
    function_builder as function,
    return_builder as return,
    this_instance as this,
    import_builder as import,
    new_builder as new,
    if_builder as if,
};
