import { walk } from "zimmerframe";
import { isVoid } from "../../../shared/utils/names.js";
import * as b from "./builders.js";
import { print } from "./print/index.js";
import { cleanNodes } from "../utils.js";

const outputName = "html";
const propsName = "props";

/**
 * @typedef {{
 *  append(value: any): void;
 *  appendText(value: string): void;
 *  options: import("../../../types.js").CompilerOptions;
 *  readonly block: import("./type.js").Block;
 *  nonPropVars: string[];
 * }} State
 */

/**
 * @type {import("../types.js").Transformer}
 */
export function renderPhpSSR(ast, analysis, options, meta) {
    const renderMethod = b.method("render", "string");

    renderMethod.isStatic = true;
    renderMethod.arguments.push(
        b.parameter(propsName, "object"),
        b.parameter("render", "callable")
    );

    renderBlock(renderMethod.body, ast, [], options);

    const renderer = b.declareClass(options.filename.replace(/\..*$/, ""), [
        renderMethod,
    ]);

    const result = print(
        b.program([
            b.namespace(options.namespace, [
                b.use(options.internalsNamespace, "Internals"),
                renderer,
            ]),
        ])
    );

    return result;
}

/**
 * @param {import("./type.js").Block} block
 * @param {import("#ast").Root} node
 * @param {string[][]} scope
 * @param {import("../../../types.js").CompilerOptions} options
 */
function renderBlock(block, node, scope, options) {
    const outputValue = b.array([]);
    const outputAssign = b.assign(b.variable(outputName), "=", outputValue);

    block.children.push(outputAssign);

    /** @type {State} */
    const state = createState(block, options);

    walk(node, state, visitors);

    let returned;

    const implode = (/** @type {import("./type.js").Expression} */ expr) =>
        b.call(b.name("implode"), [b.literal(""), expr]);

    const last = block.children.at(-1);
    if (
        last?.kind === "expressionstatement" &&
        last.expression.kind === "assign" &&
        last.expression.left.kind === "variable" &&
        last.expression.left.name === outputName &&
        last.expression.operator === "=" &&
        last.expression.right === outputValue
    ) {
        block.children.pop();

        if (outputValue.items.length <= 1) {
            returned = outputValue.items[0]?.value ?? b.string("");
        } else {
            returned = implode(outputAssign.expression.right);
        }
    } else {
        returned = implode(outputAssign.expression.left);
    }

    block.children.push(b.returnExpression(returned));
}

/**
 * @param {import("./type.js").Block} block
 * @param {import("../../../types.js").CompilerOptions} options
 * @returns {State}
 */
function createState(block, options) {
    return {
        options,
        nonPropVars: [],
        get block() {
            return block;
        },
        append(value) {
            const previous = block.children.at(-1);

            if (
                value.kind === "string" &&
                previous?.kind === "expressionstatement" &&
                previous.expression.kind === "assign" &&
                previous.expression.left.kind === "offsetlookup" &&
                previous.expression.left.what.kind === "variable" &&
                previous.expression.left.what.name === outputName &&
                previous.expression.operator === "=" &&
                previous.expression.right.kind === "string"
            ) {
                previous.expression.right.value += value.value;
                previous.expression.right.raw = `'${previous.expression.right.value}'`;
            } else if (
                previous?.kind === "expressionstatement" &&
                previous.expression.kind === "assign" &&
                previous.expression.left.kind === "variable" &&
                previous.expression.left.name === outputName &&
                previous.expression.operator === "=" &&
                previous.expression.right.kind === "array"
            ) {
                const last = previous.expression.right.items.at(-1);

                if (last?.value.kind === "string" && value.kind === "string") {
                    last.value.value += value.value;
                    last.value.raw = `'${last.value.value}'`;
                } else {
                    previous.expression.right.items.push(b.entry(value));
                }
            } else {
                block.children.push(
                    b.assign(b.offsetLookup(b.variable(outputName)), "=", value)
                );
            }
        },
        appendText(value) {
            this.append(b.string(value));
        },
    };
}

/**
 * @type {import("zimmerframe").Visitors<import("#ast").ZvelteNode, State>}
 */
const visitors = {
    _(node, { next, state }) {
        if (!(node.type in visitors)) {
            state.appendText(`[ ${node.type} ]`);
        } else {
            next();
        }
    },

    Root(node, { visit }) {
        visit(node.fragment);
    },

    Fragment(node, { visit, state, path }) {
        const parent = path[path.length - 1];
        state.appendText("<!--[-->");

        const { trimmed, hoisted } = cleanNodes(
            parent,
            node.nodes,
            path,
            "html",
            state.options.preserveWhitespace,
            state.options.preserveComments
        );

        for (const node of hoisted) {
            visit(node);
        }

        for (const node of trimmed) {
            visit(node);
        }

        state.appendText("<!--]-->");
    },

    Text(node, { state }) {
        state.appendText(node.data);
    },

    IfBlock(node, { state, visit }) {
        state.appendText("<!--[-->");

        // @ts-ignore
        const test = /** @type {import("./type.js").Expression} */ (
            visit(node.test)
        );

        const consequent = createState(b.block(), state.options);
        const alternate = createState(b.block(), state.options);

        visit(node.consequent, consequent);

        if (node.alternate) {
            visit(node.alternate, alternate);
        }

        consequent.appendText("<!--]-->");
        alternate.appendText("<!--]!-->");

        state.block.children.push(
            b.ifStatement(test, consequent.block, alternate.block)
        );
    },

    RegularElement(node, { state, path, visit }) {
        const parent = path[path.length - 1];

        state.appendText(`<${node.name}`);

        for (const attr of node.attributes) {
            switch (attr.type) {
                case "Attribute": {
                    state.appendText(` ${attr.name}`);

                    if (attr.value !== true) {
                        state.appendText(`="`);
                        for (const value of attr.value) {
                            visit(value);
                        }
                        state.appendText(`"`);
                    }
                    break;
                }

                case "OnDirective":
                case "TransitionDirective":
                case "UseDirective": {
                    // Do nothing, useless for ssr
                    break;
                }

                default:
                    throw new Error(
                        `Unknown "${attr.type}" attribute type on "${node.type}"`
                    );
            }
        }

        if (isVoid(node.name)) {
            state.appendText(`>`);
            return;
        }

        state.appendText(`>`);

        const { trimmed, hoisted } = cleanNodes(
            parent,
            node.fragment.nodes,
            path,
            "html",
            state.options.preserveWhitespace,
            state.options.preserveComments
        );

        for (const node of hoisted) {
            visit(node);
        }

        for (const node of trimmed) {
            visit(node);
        }

        state.appendText(`</${node.name}>`);
    },

    ExpressionTag(node, { state, visit }) {
        /** @type {import("./type.js").Expression} */
        // @ts-ignore
        let expression = visit(node.expression);

        expression = b.call(b.identifier("htmlspecialchars"), [
            expression,
            b.identifier("ENT_QUOTES"),
        ]);

        state.append(expression);
    },

    RenderTag(node, { state }) {
        state.append(b.call(b.variable("render"), []));
    },

    // @ts-ignore
    BinaryExpression(node, { visit }) {
        return b.bin(
            // @ts-ignore
            visit(node.left),
            // @ts-ignore
            { "~": "." }[node.operator] ?? node.operator,
            // @ts-ignore
            visit(node.right)
        );
    },

    // @ts-ignore
    NumericLiteral(node) {
        return b.number(node.value);
    },

    // @ts-ignore
    StringLiteral(node) {
        return b.string(node.value);
    },

    // @ts-ignore
    BooleanLiteral(node) {
        return b.boolean(node.value);
    },

    // @ts-ignore
    NullLiteral() {
        return b.nullKeyword();
    },

    // @ts-ignore
    ArrayExpression(node, { visit }) {
        const array = b.array();

        for (const element of node.elements) {
            // @ts-ignore
            array.items.push(visit(element));
        }

        return array;
    },

    // @ts-ignore
    ObjectExpression(node, { visit }) {
        const object = new Map();

        for (const prop of node.properties) {
            object.set(
                prop.key.type === "Identifier"
                    ? b.string(prop.key.name)
                    : visit(prop.key),
                visit(prop.value)
            );
        }

        return b.object(object);
    },

    // @ts-ignore
    ConditionalExpression(node, { visit }) {
        const test = /** @type {any} */ (visit(node.test));
        const consequent = /** @type {any} */ (visit(node.consequent));
        const alternate = /** @type {any} */ (visit(node.alternate));

        return b.ternary(test, consequent, alternate);
    },

    // @ts-ignore
    UnaryExpression(node, { visit }) {
        const what = /** @type {any} */ (visit(node.argument));
        const operator = node.operator === "not" ? "!" : node.operator;

        return b.unary(operator, what);
    },

    // @ts-ignore
    LogicalExpression(node, { visit }) {
        const left = /** @type {any} */ (visit(node.left));
        const right = /** @type {any} */ (visit(node.right));

        let operator;

        switch (node.operator) {
            case "and":
                operator = "&&";
                break;

            case "or":
                operator = "||";
                break;

            default:
                operator = node.operator;
                break;
        }

        return b.bin(left, operator, right);
    },

    // @ts-ignore
    RangeExpression(node, { visit }) {
        const start = /** @type {any} */ (visit(node.from));
        const end = /** @type {any} */ (visit(node.to));

        return b.call(b.identifier("range"), [start, end, b.number(node.step)]);
    },

    // @ts-ignore
    IsExpression(node, { visit }) {
        const left = /** @type {any} */ (visit(node.left));

        if (node.right.type === "Identifier" && node.right.name === "empty") {
            const expression = b.empty(left);

            return node.not ? b.unary("!", expression) : expression;
        }

        if (node.right.type === "NullLiteral") {
            return b.bin(left, node.not ? "!==" : "===", b.nullKeyword());
        }

        if (node.right.type === "Identifier" && node.right.name === "defined") {
            const expression = b.isset(left);
            return node.not ? b.unary("!", expression) : expression;
        }

        throw new Error(`Unknown IsExpression kind "${node.right.type}"`);
    },

    // @ts-ignore
    InExpression(node, { visit }) {
        const right = /** @type {any} */ (visit(node.right));
        const left = /** @type {any} */ (visit(node.left));

        const expression = b.call(b.staticLookup(b.name("Internals"), "in"), [
            left,
            right,
        ]);

        return node.not ? b.unary("!", expression) : expression;
    },

    // @ts-ignore
    FilterExpression(node, { visit }) {
        const args = [b.variable("props"), b.string(node.name.name)];

        for (const arg of node.arguments) {
            args.push(/** @type {any} */ (visit(arg)));
        }

        return b.call(b.staticLookup(b.name("Internals"), "filter"), args);
    },

    // @ts-ignore
    CallExpression(node, { visit }) {
        const what = /** @type {any} */ (visit(node.callee));
        const args = [];

        for (const arg of node.arguments) {
            args.push(/** @type {any} */ (visit(arg)));
        }

        return b.call(what, args, true);
    },

    // @ts-ignore
    ArrowFunctionExpression(node, { visit, state }) {
        const args = [];
        const nonPropVars = [];

        for (const arg of node.params) {
            nonPropVars.push(arg.name);
            args.push(b.variable(arg.name));
        }

        const body = /** @type {any} */ (
            visit(node.body, {
                ...state,
                nonPropVars: [...state.nonPropVars, ...nonPropVars],
            })
        );

        return b.arrow(args, body);
    },

    // @ts-ignore
    Identifier(node, { state, path, visit }) {
        const parent = path[path.length - 1];

        if (parent.type === "MemberExpression" && !parent.computed) {
            return b.identifier(node.name);
        }

        if (state.nonPropVars.includes(node.name)) {
            return b.variable(node.name);
        }

        return b.propertyLookup(b.variable("props"), b.identifier(node.name));
    },

    // @ts-ignore
    MemberExpression(node, { path, visit }) {
        const parent = path[path.length - 1];
        const what = /** @type {any} */ (visit(node.object));

        let offset = /** @type {any} */ (visit(node.property));

        if (node.computed) {
            offset = b.encapsedPart(offset);
        }

        if (parent.type === "MemberExpression") {
            return b.propertyLookup(what, offset);
        }

        return b.propertyLookup(
            b.propertyLookup(b.variable("props"), what),
            offset
        );
    },
};
