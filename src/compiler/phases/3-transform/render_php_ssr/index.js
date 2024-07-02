import { walk } from "zimmerframe";
import { isVoid } from "../../../shared/utils/names.js";
import * as b from "./builders.js";
import { print } from "./print/index.js";
import { cleanNodes } from "../utils.js";
import { DOMBooleanAttributes } from "../constants.js";

const outputName = "html";
const propsName = "props";

/**
 * @typedef {{
 *  append(value: any): void;
 *  appendText(value: string): void;
 *  options: import("../../../types.js").CompilerOptions;
 *  readonly block: import("./type.js").Block;
 *  nonPropVars: string[];
 *  scopeVars: string[];
 *  usedComponents: import("./type.js").Entry[];
 *  counter: number;
 *  import(name: string): void;
 *  internal(method: string, ...args: import("./type.js").Expression[]): import("./type.js").Call;
 * }} State
 *
 * @typedef {import("zimmerframe").Context<import("#ast").ZvelteNode, State>} ComponentContext
 */

/**
 * @type {import("../types.js").Transformer}
 */
export function renderPhpSSR(ast, analysis, options, meta) {
    const renderMethod = b.method("render", "string");
    const getAllComponentsMethod = b.method("getAllComponents", "array");

    renderMethod.isStatic = true;
    renderMethod.arguments.push(b.parameter(propsName, "object"));

    getAllComponentsMethod.isStatic = true;
    const param = b.parameter(propsName, "object");
    getAllComponentsMethod.arguments.push(param);
    param.nullable = true;
    param.value = b.nullKeyword();

    /**
     * @type {Set<string>}
     */
    const internalImports = new Set();
    const state = createState(
        {
            options,
            nonPropVars: [],
            scopeVars: [],
            usedComponents: [],
            counter: 0,
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

    const renderer = b.declareClass(options.filename.replace(/\..*$/, ""), [
        renderMethod,
        getAllComponentsMethod,
    ]);

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
    const outputValue = b.array([]);
    const outputAssign = b.assign(b.variable(outputName), "=", outputValue);

    state.block.children.push(outputAssign);

    if (!path.length && state.options.async) {
        state.appendText("<!--[--><!--[--><!--[-->");
    }

    for (const node of nodes) {
        visit(node, state);
    }

    if (!path.length && state.options.async) {
        state.appendText("<!--]--><!--]--><!--]-->");
    }

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
 * @param {Omit<State, "block" | "append" | "appendText">} state
 * @param {import("./type.js").Block} block
 * @returns {State}
 */
function createState(state, block) {
    return {
        ...state,
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
                    b.assign(
                        b.offsetLookup(b.variable(outputName)),
                        "=",
                        value,
                    ),
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
        state.appendText(node.data);
    },

    IfBlock(node, { state, visit }) {
        state.appendText("<!--[-->");

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

        consequent.appendText("<!--]-->");
        alternate.appendText("<!--]!-->");

        state.block.children.push(
            b.ifStatement(test, consequent.block, alternate.block),
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

        forEachState.appendText("<!--[-->");
        visit(node.body, forEachState);
        forEachState.appendText("<!--]-->");

        forEach.body.children.push(b.assign(index, "+=", b.number(1)));
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
                            state.appendText(` ${attr.name}="`);
                            state.appendText(attr.value[0].data);
                            state.appendText(`"`);
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

        const args = node.expression.arguments.map((arg) => {
            return /** @type {any} */ (visit(arg));
        });

        const call = b.call(callee, args, true);
        const test = b.call(b.id("is_callable"), [callee]);

        state.appendText("<!--[-->");
        state.append(b.ternary(test, call, b.string("")));
        state.appendText("<!--]-->");
    },

    HtmlTag(node, { state, visit }) {
        state.append(visit(node.expression));
    },

    KeyBlock(node, { state, visit }) {
        state.appendText("<!--[-->");
        visit(node.fragment);
        state.appendText("<!--]-->");
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
        const name = /** @type {any} */ (visit(node.name));
        const value = /** @type {any} */ (visit(node.value));

        state.block.children.push(b.assign(name, "=", value));
    },

    Component(node, context) {
        const className = b.name(node.key.data);
        const props = getComponentProps(node, context);

        context.state.usedComponents.push(
            b.entry(
                b.objectFromLiteral({
                    key: b.string(node.key.data),
                    props,
                }),
            ),
        );

        context.state.appendText("<!--[-->");
        context.state.append(
            context.state.internal(
                "component",
                b.string(className.name),
                props,
            ),
        );
        context.state.appendText("<!--]-->");
    },

    ZvelteComponent(node, context) {
        const callee = /** @type {any} */ (context.visit(node.expression));
        const props = getComponentProps(node, context);

        context.state.appendText("<!--[-->");
        context.state.append(
            b.ternary(callee, b.call(callee, [props], true), b.string("")),
        );
        context.state.appendText("<!--]-->");
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
        const left = /** @type {any} */ (visit(node.left));

        if (node.right.type === "Identifier" && node.right.name === "empty") {
            const expression = state.internal("testEmpty", left);

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

        if (state.scopeVars.includes(node.name)) {
            return b.propertyLookup(b.variable("scope"), b.id(node.name));
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

        if (member.what.kind === "identifier") {
            if (!state.nonPropVars.includes(member.what.name)) {
                member = b.propertyLookup(b.variable(propsName), member);
            } else if (state.scopeVars.includes(member.what.name)) {
                member = b.propertyLookup(b.variable("scope"), member);
            } else {
                member.what = b.variable(member.what.name);
            }
        }

        return member;
    },
};

/**
 * @param {import("#ast").ZvelteComponent | import("#ast").Component} node
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
    const scopeVars = [...new Set(context.state.nonPropVars)];
    const nonPropVars = [...context.state.nonPropVars];

    const params = [b.parameter(propsName), b.parameter("scope")];

    for (const param of parameters) {
        nonPropVars.push(param.name);
        params.push(b.parameter(param.name));
    }

    const fn = b.closure(true, params);
    const scope = b.cast(
        b.array(scopeVars.map((v) => b.entry(b.variable(v), b.string(v)))),
        "object",
    );

    context.state.import("Snippet");
    const snippet = b.new("Snippet", b.variable("props"), scope, fn);

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
                    scopeVars,
                    nonPropVars,
                },
                fn.body,
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
            args.length === 1
                ? /** @type {import('./type.js').Cast} */ (args[0])
                : state.internal(
                      "spread_props",
                      b.array(args.map((arg) => b.entry(arg))),
                  ),
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
            texts.push("%");
            let expression = /** @type {any} */ (visit(node.expression, state));

            if (attributeValue.length !== 1 && isElement) {
                expression = b.bin(expression, "??", b.literal(""));
            }

            expressions.push(expression);
        } else if (node.type === "ClassDirective") {
            if (texts[texts.length - 1]) {
                texts.push(" %");
            } else {
                texts.push("%");
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

    return texts.filter((t) => t !== "%").length
        ? !expressions.length
            ? b.string(texts[0])
            : b.call("sprintf", [b.string(texts.join("")), ...expressions])
        : expressions[0];
}
