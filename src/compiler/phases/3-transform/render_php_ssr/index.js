import { walk } from "zimmerframe";
import { isVoid } from "../../../shared/utils/names.js";
import * as b from "./builders.js";
import { print } from "./print/index.js";
import { cleanNodes } from "../utils.js";
import { DOMBooleanAttributes } from "../constants.js";
import {
    HYDRATION_END,
    HYDRATION_END_ELSE,
    HYDRATION_START,
} from "../../constants.js";

const outputName = "payload";
const propsName = "props";

/**
 * @typedef {{
 *  append(value: any): void;
 *  appendHead(value: any): void;
 *  setTitle(value: import("./type.js").StringLiteral): void;
 *  appendText(value: string): void;
 *  options: import("../../../types.js").CompilerOptions;
 *  readonly block: import("./type.js").Block;
 *  nonPropVars: string[];
 *  scopeVars: string[];
 *  isInIsset: boolean;
 *  usedComponents: import("./type.js").Entry[];
 *  counter: number;
 *  import(name: string): void;
 *  internal(method: string, ...args: import("./type.js").Expression[]): import("./type.js").Call;
 *  componentName: string;
 *  imports: import("#ast").Root["imports"];
 * }} State
 *
 * @typedef {import("zimmerframe").Context<import("#ast").ZvelteNode, State>} ComponentContext
 */

/**
 * @type {import("../types.js").Transformer}
 */
export function renderPhpSSR(source, ast, analysis, options, meta) {
    const renderMethod = b.method("render", "void");
    const getAllComponentsMethod = b.method("getAllComponents", "array");

    renderMethod.isStatic = true;
    renderMethod.arguments.push(
        b.parameter(outputName, "object"),
        b.parameter(propsName, "object"),
    );

    getAllComponentsMethod.isStatic = true;
    const param = b.parameter(propsName, "object");
    getAllComponentsMethod.arguments.push(param);
    param.nullable = true;
    param.value = b.nullKeyword();

    const componentName = options.filename.replace(/\..*$/, "");

    /**
     * @type {Set<string>}
     */
    const internalImports = new Set();
    const state = createState(
        {
            isInIsset: false,
            options,
            nonPropVars: [],
            scopeVars: [],
            usedComponents: [],
            imports: ast.imports,
            counter: 0,
            componentName,
            import(name) {
                internalImports.add(name);
            },
            internal(method, ...args) {
                internalImports.add("Internals");
                return b.call(
                    b.staticLookup(b.name("Internals"), method),
                    args,
                );
            },
        },
        renderMethod.body,
    );

    walk(ast, state, visitors);

    getAllComponentsMethod.body.children.push(
        b.assign(b.variable(propsName), "??=", b.object()),
        b.returnExpression(b.array(state.usedComponents)),
    );

    const renderer = b.declareClass(componentName, [renderMethod]);

    const namespace = [];

    if (internalImports.size) {
        namespace.push(
            b.use(options.internalsNamespace, ...[...internalImports]),
        );
    }

    namespace.push(renderer);

    const result = print(
        b.program([b.namespace(options.namespace, namespace)]),
    );

    return result;
}

/**
 * @param {ComponentContext} context
 * @param {import("#ast").ZvelteNode[]} nodes
 */
function renderBlock({ path, state, visit }, nodes) {
    if (!path.length && state.options.async) {
        state.appendText(`<!--${HYDRATION_START}-->`);
    }

    for (const node of nodes) {
        visit(node, state);
    }

    if (!path.length && state.options.async) {
        state.appendText(`<!--${HYDRATION_END}-->`);
    }
}

/**
 * @param {Omit<State, "block" | "append" | "appendText" | "appendHead" | "setTitle">} state
 * @param {import("./type.js").Block} block
 * @returns {State}
 */
function createState(state, block) {
    const createAppend = (/** @type {string} */ property) => {
        return (/** @type {import("./type.js").Expression} */ value) => {
            const previous = block.children.at(-1);

            if (
                value.kind === "string" &&
                previous?.kind === "expressionstatement" &&
                previous.expression.kind === "assign" &&
                previous.expression.left.kind === "propertylookup" &&
                previous.expression.left.what.kind === "variable" &&
                previous.expression.left.what.name === outputName &&
                previous.expression.left.offset.kind === "identifier" &&
                previous.expression.left.offset.name === property &&
                previous.expression.operator === ".=" &&
                previous.expression.right.kind === "string"
            ) {
                previous.expression.right.value += value.value;
                previous.expression.right.raw = `'${previous.expression.right.value}'`;
            } else {
                block.children.push(
                    b.assign(
                        b.propertyLookup(
                            b.variable(outputName),
                            b.id(property),
                        ),
                        ".=",
                        value,
                    ),
                );
            }
        };
    };

    return {
        ...state,
        get block() {
            return block;
        },
        append: createAppend("out"),
        appendHead: createAppend("head"),
        setTitle(string) {
            block.children.push(
                b.assign(
                    b.propertyLookup(b.variable(outputName), b.id("title")),
                    "=",
                    string,
                ),
            );
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

    Root(node, context) {
        const { trimmed, hoisted } = cleanNodes(
            node,
            node.fragment.nodes,
            [node],
            undefined,
            context.state.options.preserveWhitespace,
            context.state.options.preserveComments,
        );

        renderBlock(context, [...hoisted, ...trimmed]);
    },

    Fragment(node, { visit, state, path }) {
        const parent = path[path.length - 1];

        const { trimmed, hoisted } = cleanNodes(
            parent,
            node.nodes,
            path,
            "html",
            state.options.preserveWhitespace,
            state.options.preserveComments,
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

    Comment(node, { state }) {
        state.appendText(`<!--${node.data}-->`);
    },

    IfBlock(node, { state, visit }) {
        state.appendText(`<!--${HYDRATION_START}-->`);

        // @ts-ignore
        const test = /** @type {import("./type.js").Expression} */ (
            visit(node.test)
        );

        const consequent = createState(state, b.block());
        const alternate = createState(state, b.block());

        visit(node.consequent, consequent);

        if (node.alternate) {
            visit(node.alternate, alternate);
        }

        consequent.appendText(`<!--${HYDRATION_END}-->`);
        alternate.appendText(`<!--${HYDRATION_END_ELSE}-->`);

        state.block.children.push(
            b.ifStatement(test, consequent.block, alternate.block),
        );
    },

    ForBlock(node, { state, path, visit }) {
        state.appendText(`<!--${HYDRATION_START}-->`);

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
                b.assign(b.variable("parent"), "=", b.variable("loop")),
            );
        }

        const forEachState = createState(state, forEach.body);
        const length = b.variable("length");

        state.block.children.push(b.assign(index, "=", b.number(0)));
        forEachState.block.children.push(
            b.assign(
                length,
                "=",
                b.call(b.id("count"), [b.cast(source, "array")]),
            ),
        );

        if (node.fallback) {
            const ifBlock = b.ifStatement(
                b.unary("!", state.internal("testEmpty", source)),
            );
            ifBlock.alternate = b.block();

            const ifState = createState(state, ifBlock.body);
            const fallbackState = createState(state, ifBlock.alternate);

            ifBlock.body.children.push(forEach);
            state.block.children.push(ifBlock);

            visit(node.fallback, fallbackState);
            ifState.appendText(`<!--${HYDRATION_END}-->`);
            fallbackState.appendText(`<!--${HYDRATION_END_ELSE}-->`);
        } else {
            state.block.children.push(forEach);
            state.appendText(`<!--${HYDRATION_END}-->`);
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
                                    b.number(1),
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
                                    b.bin(length, "-", b.number(1)),
                                ),
                            ],
                            [b.string("length"), length],
                            [
                                b.string("parent"),
                                hasParent
                                    ? b.variable("parent")
                                    : b.nullKeyword(),
                            ],
                        ]),
                    ),
                ),
            ),
        );

        forEachState.nonPropVars = [
            ...forEachState.nonPropVars,
            ...nonPropVars,
        ];

        forEachState.appendText(`<!--${HYDRATION_START}-->`);
        visit(node.body, forEachState);
        forEachState.appendText(`<!--${HYDRATION_END}-->`);

        forEach.body.children.push(b.assign(index, "+=", b.number(1)));
    },

    AwaitBlock(node, { state, visit }) {
        state.appendText(`<!--${HYDRATION_START}-->`);
        if (node.pending) {
            visit(node.pending);
        }
        state.appendText(`<!--${HYDRATION_END}-->`);
    },

    RegularElement(node, { state, path, visit }) {
        const parent = path[path.length - 1];

        state.appendText(`<${node.name}`);

        if (node.attributes.some((a) => a.type === "SpreadAttribute")) {
            /** @type {import("./type.js").Entry[]} */
            const attrs = [];
            /** @type {Record<string, import("./type.js").Expression>} */
            const classes = {};

            for (const attr of node.attributes) {
                switch (attr.type) {
                    case "Attribute": {
                        const value = serializeAttributeValue(
                            attr.value,
                            false,
                            { visit, state },
                        );
                        const n = b.entry(value, b.literal(attr.name));
                        attrs.push(n);
                        break;
                    }

                    case "SpreadAttribute": {
                        const value = /** @type {any} */ (
                            visit(attr.expression)
                        );
                        attrs.push(b.entry(value, undefined, true));
                        break;
                    }

                    case "ClassDirective": {
                        const value = /** @type {any} */ (
                            visit(attr.expression)
                        );
                        classes[attr.name] = value;
                        break;
                    }

                    default:
                        break;
                }
            }

            const args = [b.cast(b.array(attrs), "object")];

            if (Object.keys(classes).length) {
                args.push(b.objectFromLiteral(classes));
            }

            state.append(state.internal("spread_attributes", ...args));
        } else {
            const classDirectives =
                /** @type {Array<import("#ast").ClassDirective>} */ (
                    node.attributes.filter((a) => a.type === "ClassDirective")
                );

            for (const attr of node.attributes) {
                switch (attr.type) {
                    case "Attribute": {
                        if (classDirectives.length && attr.name === "class") {
                            /**
                             * @type {Array<import("#ast").Text | import("#ast").ExpressionTag | import("#ast").ClassDirective>}
                             */
                            const values =
                                attr.value === true
                                    ? [
                                          /** @type {import("#ast").Text} */ ({
                                              type: "Text",
                                              data: "",
                                          }),
                                      ]
                                    : attr.value.slice();

                            values.push(...classDirectives);

                            state.append(
                                state.internal(
                                    "attr",
                                    b.string(attr.name),
                                    serializeAttributeValue(values, true, {
                                        visit,
                                        state,
                                    }),
                                ),
                            );

                            classDirectives.length = 0;
                            break;
                        }

                        if (attr.value === true) {
                            state.appendText(` ${attr.name}`);
                            if (!DOMBooleanAttributes.includes(attr.name)) {
                                state.appendText(`=""`);
                            }
                        } else if (
                            attr.value.length === 1 &&
                            attr.value[0].type === "Text"
                        ) {
                            const quote = attr.doubleQuotes ? '"' : "'";

                            state.appendText(` ${attr.name}=${quote}`);
                            state.appendText(attr.value[0].data);
                            state.appendText(quote);
                        } else {
                            state.append(
                                state.internal(
                                    "attr",
                                    b.string(attr.name),
                                    serializeAttributeValue(attr.value, true, {
                                        visit,
                                        state,
                                    }),
                                ),
                            );
                        }
                        break;
                    }

                    case "BindDirective": {
                        state.append(
                            state.internal(
                                "attr",
                                b.string(attr.name),
                                b.bin(
                                    /** @type {any} */ (visit(attr.expression)),
                                    "??",
                                    b.literal(""),
                                ),
                            ),
                        );
                        break;
                    }

                    case "ClassDirective": {
                        // Do nothing handled in the Attribute's case
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
                            `Unknown "${attr.type}" attribute type on "${node.type}"`,
                        );
                }
            }

            if (classDirectives.length) {
                state.append(
                    state.internal(
                        "attr",
                        b.string("class"),
                        serializeAttributeValue(classDirectives, true, {
                            visit,
                            state,
                        }),
                    ),
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
            state.options.preserveComments,
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

        expression = state.internal("escape_html", expression);

        state.append(expression);
    },

    RenderTag(node, { state, visit }) {
        const callee = /** @type {any} */ (
            visit(
                node.expression.type === "CallExpression"
                    ? node.expression.callee
                    : node.expression.name,
            )
        );

        const args = [b.variable(outputName)];

        for (const arg of node.expression.arguments) {
            args.push(/** @type {any} */ (visit(arg)));
        }

        const call = b.call(callee, args, true);
        const test = b.call(b.id("is_callable"), [callee]);

        state.appendText(`<!--${HYDRATION_START}-->`);
        state.block.children.push(b.ifStatement(test, b.block([b.stmt(call)])));
        state.appendText(`<!--${HYDRATION_END}-->`);
    },

    HtmlTag(node, { state, visit }) {
        state.append(visit(node.expression));
    },

    KeyBlock(node, { state, visit }) {
        state.appendText(`<!--${HYDRATION_START}-->`);
        visit(node.fragment);
        state.appendText(`<!--${HYDRATION_END}-->`);
    },

    SnippetBlock(node, context) {
        const fn = createSnippetClosure(
            context,
            node.parameters,
            node.body.nodes,
        );

        context.state.block.children.push(
            b.assign(
                b.propertyLookup(
                    b.variable(propsName),
                    b.id(node.expression.name),
                ),
                "=",
                fn,
            ),
        );
    },

    Variable(node, { state, visit }) {
        const assignment = /** @type {any} */ (visit(node.assignment));
        state.block.children.push(assignment);
    },

    Component(node, context) {
        const source = context.state.imports.find(
            (i) => i.specifier.name === node.name,
        )?.source.value;
        if (!source)
            throw new Error(
                `Component ${node.name} not found, forgot an import tag?`,
            );

        const className = b.name(source);
        const props = getComponentProps(node, context);

        context.state.usedComponents.push(
            b.entry(
                b.objectFromLiteral({
                    key: b.string(source),
                    props: b.object(),
                }),
            ),
        );

        context.state.appendText(`<!--${HYDRATION_START}-->`);
        context.state.block.children.push(
            b.stmt(
                context.state.internal(
                    "component",
                    b.string(className.name),
                    b.variable(outputName),
                    props,
                ),
            ),
        );
        context.state.appendText(`<!--${HYDRATION_END}-->`);
    },

    ZvelteComponent(node, context) {
        const callee = /** @type {any} */ (context.visit(node.expression));
        const props = getComponentProps(node, context);

        context.state.appendText(`<!--${HYDRATION_START}-->`);
        context.state.block.children.push(
            b.ifStatement(
                b.call("is_callable", [callee]),
                b.block([
                    b.stmt(
                        b.call(callee, [b.variable(outputName), props], true),
                    ),
                ]),
            ),
        );
        context.state.appendText(`<!--${HYDRATION_END}-->`);
    },

    ZvelteSelf(node, context) {
        const props = getComponentProps(node, context);

        context.state.appendText(`<!--${HYDRATION_START}-->`);
        context.state.append(
            b.call(b.staticLookup(b.name("self"), "render"), [
                b.variable(outputName),
                props,
            ]),
        );
        context.state.appendText(`<!--${HYDRATION_END}-->`);
    },

    TitleElement(node, context) {
        /**
         * @type {import("./type.js").Expression[]}
         */
        const elements = [];

        for (const child of node.fragment.nodes) {
            switch (child.type) {
                case "Text":
                    let last = elements[elements.length - 1];
                    if (!last) {
                        elements.push((last = b.literal("")));
                    }
                    if (last.kind === "string") {
                        last.value += child.data;
                        last.raw = `'${last.value}'`;
                    } else {
                        elements.push(b.literal(child.data));
                    }
                    break;

                case "ExpressionTag":
                    const expression = /** @type {any} */ (
                        context.visit(child.expression)
                    );
                    elements.push(expression);
                    break;

                default:
                    throw new Error(
                        "`<title>` can only contain text and {{ tags }}",
                    );
            }
        }

        const value = !elements.length
            ? b.string("")
            : elements.length === 1
              ? elements[0]
              : b.call(b.id("implode"), [
                    b.literal(""),
                    b.array(elements.map((e) => b.entry(e))),
                ]);

        context.state.block.children.push(
            b.assign(
                b.propertyLookup(b.variable(outputName), b.id("title")),
                "=",
                value,
            ),
        );
    },

    ZvelteHead(node, { state, visit }) {
        const head = b.closure(
            true,
            [b.parameter(outputName, "object")],
            [b.variable(propsName)],
        );

        visit(node.fragment, createState(state, head.body));

        state.block.children.push(
            b.stmt(state.internal("head", b.variable(outputName), head)),
        );
    },

    // @ts-ignore
    AssignmentExpression(node, { visit }) {
        return b.assign(
            /** @type {any} */ (visit(node.left)),
            node.operator === "~=" ? ".=" : node.operator,
            /** @type {any} */ (visit(node.right)),
        );
    },

    // @ts-ignore
    UpdateExpression(node, { visit }) {
        const type = node.operator === "++" ? "+" : "-";
        const what = /** @type {any} */ (visit(node.argument));

        return node.prefix ? b.pre(type, what) : b.post(type, what);
    },

    // @ts-ignore
    BinaryExpression(node, { visit }) {
        return b.bin(
            // @ts-ignore
            visit(node.left),
            // @ts-ignore
            { "~": "." }[node.operator] ?? node.operator,
            // @ts-ignore
            visit(node.right),
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
                visit(prop.value),
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
    IsExpression(node, { state, visit }) {
        if (node.right.type === "Identifier" && node.right.name === "defined") {
            const left = /** @type {any} */ (
                visit(node.left, {
                    ...state,
                    isInIsset: true,
                })
            );
            const expression = b.isset(left);
            return node.not ? b.unary("!", expression) : expression;
        }

        const left = /** @type {any} */ (visit(node.left));

        if (node.right.type === "Identifier" && node.right.name === "empty") {
            const expression = state.internal("testEmpty", left);
            return node.not ? b.unary("!", expression) : expression;
        }

        if (
            node.right.type === "Identifier" &&
            node.right.name === "iterable"
        ) {
            const expression = b.call("is_iterable", [left]);
            return node.not ? b.unary("!", expression) : expression;
        }

        const right = /** @type {any} */ (visit(node.right));
        return b.bin(left, node.not ? "!==" : "===", right);
    },

    // @ts-ignore
    InExpression(node, { state, visit }) {
        const right = /** @type {any} */ (visit(node.right));
        const left = /** @type {any} */ (visit(node.left));

        const expression = state.internal("in", left, right);

        return node.not ? b.unary("!", expression) : expression;
    },

    // @ts-ignore
    FilterExpression(node, { state, visit }) {
        const args = [b.variable(propsName), b.string(node.name.name)];

        for (const arg of node.arguments) {
            args.push(/** @type {any} */ (visit(arg)));
        }

        return state.internal("filter", ...args);
    },

    // @ts-ignore
    CallExpression(node, { visit }) {
        const what = /** @type {any} */ (visit(node.callee));
        const args = [];

        for (const arg of node.arguments) {
            args.push(/** @type {any} */ (visit(arg)));
        }

        const call = b.call(what, args, true);

        if (node.optional) {
            return b.ternary(
                b.call("is_callable", [what]),
                call,
                b.nullKeyword(),
            );
        }

        return call;
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

        let id = propsName;

        if (
            state.scopeVars.includes(node.name) &&
            (parent.type !== "MemberExpression" || parent.computed)
        ) {
            id = "scope";
        } else {
            if (parent.type === "MemberExpression" && !parent.computed) {
                return b.id(node.name);
            }

            if (state.nonPropVars.includes(node.name)) {
                return b.variable(node.name);
            }
        }

        const out = b.propertyLookup(b.variable(propsName), b.id(node.name));

        if (!state.isInIsset) {
            return b.silent(out);
        }

        return out;
    },

    // @ts-ignore
    MemberExpression(node, { state, path, visit }) {
        const parent = path[path.length - 1];

        let what = /** @type {any} */ (visit(node.object));
        let offset = /** @type {any} */ (visit(node.property));

        if (node.computed) {
            offset = b.encapsedPart(offset);
        }

        /** @type {import("./type.js").Expression} */
        let member = b.propertyLookup(what, offset, node.optional);

        if (member.what.kind === "identifier") {
            if (!state.nonPropVars.includes(member.what.name)) {
                member = b.propertyLookup(b.variable(propsName), member);
            } else if (state.scopeVars.includes(member.what.name)) {
                member = b.propertyLookup(b.variable("scope"), member);
            } else {
                member.what = b.variable(member.what.name);
            }
        }

        if (
            parent.type !== "MemberExpression" ||
            (parent.computed && !state.isInIsset)
        ) {
            member = b.silent(member);
        }

        return member;
    },
};

/**
 * @param {import("#ast").ZvelteSelf | import("#ast").ZvelteComponent | import("#ast").Component} node
 * @param {ComponentContext} context
 */
function getComponentProps(node, context) {
    const parent = context.path[context.path.length - 1];
    const { props, pushProp } = serializeAttibutesForComponent(
        node.attributes,
        context,
    );

    const { trimmed, hoisted } = cleanNodes(
        parent,
        node.fragment.nodes,
        context.path,
        "html",
        context.state.options.preserveWhitespace,
        context.state.options.preserveComments,
    );

    for (const node of hoisted) {
        if (node.type === "SnippetBlock") {
            const value = createSnippetClosure(
                context,
                node.parameters,
                node.body.nodes,
            );
            pushProp(b.entry(value, b.string(node.expression.name)));
        } else {
            context.visit(node);
        }
    }

    if (trimmed.length) {
        const value = createSnippetClosure(context, [], trimmed);
        pushProp(b.entry(value, b.string("children")));
    }

    return props;
}

/**
 * @param {ComponentContext} context
 * @param {import("#ast").Identifier[]} parameters
 * @param {import("#ast").ZvelteNode[]} nodes
 */
function createSnippetClosure(context, parameters, nodes) {
    const parent = context.path[context.path.length - 1];
    const nonPropVars = [...context.state.nonPropVars];

    const params = [b.parameter(outputName)];

    for (const param of parameters) {
        nonPropVars.push(param.name);
        params.push(b.parameter(param.name));
    }

    const snippet = b.closure(true, params, [
        b.variable("props"),
        ...nonPropVars.map((n) => b.variable(n)),
    ]);

    const { trimmed, hoisted } = cleanNodes(
        parent,
        nodes,
        context.path,
        "html",
        context.state.options.preserveWhitespace,
        context.state.options.preserveComments,
    );

    renderBlock(
        {
            ...context,
            state: createState(
                {
                    ...context.state,
                    nonPropVars,
                },
                snippet.body,
            ),
        },
        [...hoisted, ...trimmed],
    );

    return snippet;
}

/**
 * @param {Array<import("#ast").ZvelteComponent["attributes"][number] | import("#ast").Component["attributes"][number]>} attributes
 * @param {Pick<ComponentContext, "visit" | "state">} context
 */
function serializeAttibutesForComponent(attributes, { visit, state }) {
    /**
     * @type {(import("./type.js").Expression)[]}
     */
    const args = [];

    function last() {
        let last = args[args.length - 1];
        if (
            last?.kind === "cast" &&
            last.type === "object" &&
            last.expr.kind === "array"
        )
            return last.expr.items;

        const array = b.array();
        last = b.cast(array, "object");
        args.push(last);
        return array.items;
    }

    for (const attr of attributes) {
        switch (attr.type) {
            case "Attribute": {
                const items = last();
                const value = serializeAttributeValue(attr.value, false, {
                    visit,
                    state,
                });

                items.push(b.entry(value, b.string(attr.name)));
                break;
            }

            case "BindDirective": {
                const items = last();
                const value = /** @type {any} */ (visit(attr.expression));
                items.push(b.entry(value, b.string(attr.name)));
                break;
            }

            case "SpreadAttribute": {
                const value = /** @type {any} */ (visit(attr.expression));
                args.push(value);
                break;
            }

            case "OnDirective": {
                // useless for ssr
                break;
            }

            default:
                break;
        }
    }

    if (!args.length) last();

    const out = {
        props:
            args.length === 1 && args[0].kind === "cast"
                ? args[0]
                : state.internal("spread_props", ...args),
        /**
         * @param {import("./type.js").Entry[]} props
         */
        pushProp(...props) {
            if (out.props.kind === "cast") {
                if (
                    out.props.type === "object" &&
                    out.props.expr.kind === "array"
                ) {
                    out.props.expr.items.push(...props);
                }
            } else {
                const last =
                    out.props.arguments[out.props.arguments.length - 1];

                if (last.kind === "cast") {
                    if (last.type === "object" && last.expr.kind === "array") {
                        last.expr.items.push(...props);
                    }
                } else {
                    out.props.arguments.push(b.cast(b.array(props), "object"));
                }
            }
        },
    };

    return out;
}

/**
 * @param {true | Array<import("#ast").Text | import("#ast").ExpressionTag | import("#ast").ClassDirective>} attributeValue
 * @param {boolean} isElement
 * @param {Pick<ComponentContext, "visit" | "state">} context
 * @returns {import("./type.js").Expression}
 */
function serializeAttributeValue(attributeValue, isElement, { visit, state }) {
    if (attributeValue === true) return b.true;

    /** @type {import("./type.js").Expression[]} */
    const expressions = [];
    const texts = [];

    for (let i = 0; i < attributeValue.length; i++) {
        const node = attributeValue[i];

        if (node.type === "Text") {
            texts.push(node.data);
        } else if (node.type === "ExpressionTag") {
            texts.push("%s");
            let expression = /** @type {any} */ (visit(node.expression, state));

            if (attributeValue.length !== 1 && isElement) {
                expression = b.bin(expression, "??", b.literal(""));
            }

            expressions.push(expression);
        } else if (node.type === "ClassDirective") {
            if (texts[texts.length - 1]) {
                texts.push(" %s");
            } else {
                texts.push("%s");
            }

            let expression = /** @type {any} */ (visit(node.expression, state));
            expression = b.ternary(
                expression,
                b.literal(node.name),
                b.literal(""),
            );

            expressions.push(expression);
        }
    }

    return texts.filter((t) => t !== "%s").length
        ? !expressions.length
            ? b.string(texts[0])
            : b.call("sprintf", [b.string(texts.join("")), ...expressions])
        : expressions[0];
}
