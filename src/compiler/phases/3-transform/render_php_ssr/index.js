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
    const getAllUsedComponents = b.method("getAllUsedComponents", "array");

    renderMethod.isStatic = true;
    renderMethod.arguments.push(b.parameter(propsName, "object"));

    const state = createState(renderMethod.body, options);

    renderBlock(state, ast);

    const allUsedComponents = b.array();
    walk(/** @type {import("#ast").ZvelteNode} */ (ast), null, {
        Component(node) {
            allUsedComponents.items.push(b.entry(b.string(node.key.data)));
        },
    });

    getAllUsedComponents.body.children.push(
        b.returnExpression(allUsedComponents)
    );

    const renderer = b.declareClass(options.filename.replace(/\..*$/, ""), [
        renderMethod,
        getAllUsedComponents,
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
 * @param {State} state
 * @param {import("#ast").Root} node
 */
function renderBlock(state, node) {
    const outputValue = b.array([]);
    const outputAssign = b.assign(b.variable(outputName), "=", outputValue);

    state.block.children.push(outputAssign);

    walk(node, state, visitors);

    let returned;

    const implode = (/** @type {import("./type.js").Expression} */ expr) =>
        b.call(b.name("implode"), [b.literal(""), expr]);

    const last = state.block.children.at(-1);
    if (
        last?.kind === "expressionstatement" &&
        last.expression.kind === "assign" &&
        last.expression.left.kind === "variable" &&
        last.expression.left.name === outputName &&
        last.expression.operator === "=" &&
        last.expression.right === outputValue
    ) {
        state.block.children.pop();

        if (outputValue.items.length <= 1) {
            returned = outputValue.items[0]?.value ?? b.string("");
        } else {
            returned = implode(outputAssign.expression.right);
        }
    } else {
        returned = implode(outputAssign.expression.left);
    }

    state.block.children.push(b.returnExpression(returned));
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
    },

    Text(node, { state }) {
        state.appendText(node.data);
    },

    Component(node, { state, visit }) {
        const staticLookup = b.staticLookup(
            b.name("\\" + node.key.data.replace(/\//g, "\\")),
            "renderHTML"
        );

        const object = {};

        for (const attr of node.attributes) {
            switch (attr.type) {
                case "Attribute": {
                    if (attr.value === true) {
                        object[attr.name] = b.boolean(true);
                    } else if (attr.value.length === 1) {
                        const v = attr.value[0];
                        object[attr.name] =
                            v.type === "Text"
                                ? b.string(v.data)
                                : visit(v.expression);
                    }
                    break;
                }

                default:
                    break;
            }
        }

        state.append(
            b.call(staticLookup, [
                b.object(
                    new Map(
                        Object.entries(object).map(([key, value]) => [
                            b.string(key),
                            value,
                        ])
                    )
                ),
            ])
        );
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

    ForBlock(node, { state, path, visit }) {
        state.appendText("<!--[-->");

        const hasParent = path.some((n) => n.type === "ForBlock");

        const source = /** @type {any} */ (visit(node.expression));
        const index = b.variable("i");
        const value = b.variable(node.context.name);
        const key = node.index ? b.variable(node.index.name) : undefined;

        const forEach = b.forEach(source, value, key);

        const nonPropVars = ["loop", value.name];

        if (key) {
            nonPropVars.push(key.name);
        }

        if (hasParent) {
            state.block.children.push(
                b.assign(b.variable("parent"), "=", b.variable("loop"))
            );
        }

        const forEachState = createState(forEach.body, state.options);
        const length = b.variable("length");

        state.block.children.push(b.assign(index, "=", b.number(0)));
        forEachState.block.children.push(
            b.assign(
                length,
                "=",
                b.call(b.id("count"), [b.cast(source, "array")])
            )
        );

        if (node.fallback) {
            const ifBlock = b.ifStatement(
                b.unary("!", b.internal("testEmpty", source))
            );
            ifBlock.alternate = b.block();

            const ifState = createState(ifBlock.body, state.options);
            const fallbackState = createState(ifBlock.alternate, state.options);

            ifBlock.body.children.push(forEach);
            state.block.children.push(ifBlock);

            visit(node.fallback, fallbackState);
            ifState.appendText("<!--]-->");
            fallbackState.appendText("<!--]!-->");
        } else {
            state.block.children.push(forEach);
            state.appendText("<!--]-->");
        }

        forEach.body.children.push(
            b.assign(
                b.variable("loop"),
                "=",
                b.object(
                    new Map(
                        /** @type {[any, any][]} */ ([
                            [b.string("index0"), index],
                            [b.string("index"), b.bin(index, "+", b.number(1))],
                            [
                                b.string("revindex0"),
                                b.bin(
                                    b.bin(length, "-", index),
                                    "-",
                                    b.number(1)
                                ),
                            ],
                            [b.string("revindex"), b.bin(length, "-", index)],
                            [
                                b.string("first"),
                                b.bin(index, "===", b.number(0)),
                            ],
                            [
                                b.string("last"),
                                b.bin(
                                    index,
                                    "===",
                                    b.bin(length, "-", b.number(1))
                                ),
                            ],
                            [b.string("length"), length],
                            [
                                b.string("parent"),
                                hasParent
                                    ? b.variable("parent")
                                    : b.nullKeyword(),
                            ],
                        ])
                    )
                )
            )
        );

        forEachState.nonPropVars = [
            ...forEachState.nonPropVars,
            ...nonPropVars,
        ];

        forEachState.appendText("<!--[-->");
        visit(node.body, forEachState);
        forEachState.appendText("<!--]-->");

        forEach.body.children.push(b.assign(index, "+=", b.number(1)));
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

                case "ClassDirective": {
                    state.append(
                        b.internal(
                            "attr",
                            b.string("class"),
                            b.ternary(
                                /** @type {any} */ (visit(attr.expression)),
                                b.string(attr.name),
                                b.string("")
                            )
                        )
                    );
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

        expression = b.internal("espace_html", expression);

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

        return b.call(b.id("range"), [start, end, b.number(node.step)]);
    },

    // @ts-ignore
    IsExpression(node, { visit }) {
        const left = /** @type {any} */ (visit(node.left));

        if (node.right.type === "Identifier" && node.right.name === "empty") {
            const expression = b.internal("testEmpty", left);

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

        const expression = b.internal("in", left, right);

        return node.not ? b.unary("!", expression) : expression;
    },

    // @ts-ignore
    FilterExpression(node, { visit }) {
        const args = [b.variable(propsName), b.string(node.name.name)];

        for (const arg of node.arguments) {
            args.push(/** @type {any} */ (visit(arg)));
        }

        return b.internal("filter", ...args);
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
    Identifier(node, { state, path }) {
        const parent = path[path.length - 1];

        if (parent.type === "MemberExpression" && !parent.computed) {
            return b.id(node.name);
        }

        if (state.nonPropVars.includes(node.name)) {
            return b.variable(node.name);
        }

        return b.propertyLookup(b.variable(propsName), b.id(node.name));
    },

    // @ts-ignore
    MemberExpression(node, { state, path, visit }) {
        const parent = path[path.length - 1];

        let what = /** @type {any} */ (visit(node.object));
        let offset = /** @type {any} */ (visit(node.property));

        if (node.computed) {
            offset = b.encapsedPart(offset);
        }

        let member = b.propertyLookup(what, offset);

        if (
            member.what.kind === "identifier" &&
            !state.nonPropVars.includes(member.what.name)
        ) {
            member = b.propertyLookup(b.variable(propsName), member);
        } else if (member.what.kind === "identifier") {
            member.what = b.variable(member.what.name);
        }

        return member;
    },
};
