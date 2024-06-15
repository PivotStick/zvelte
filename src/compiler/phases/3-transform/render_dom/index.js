import { print } from "esrap";
import * as b from "./builders.js";
import { walk } from "zimmerframe";
import { cleanNodes } from "../utils.js";
import {
    EACH_INDEX_REACTIVE,
    EACH_ITEM_REACTIVE,
    EACH_KEYED,
    TEMPLATE_FRAGMENT,
    TEMPLATE_USE_IMPORT_NODE,
    TRANSITION_GLOBAL,
    TRANSITION_IN,
    TRANSITION_OUT,
} from "../../constants.js";
import { Scope, setScope } from "./scope.js";
import {
    AttributeAliases,
    DOMBooleanAttributes,
    DOMProperties,
    PassiveEvents,
    VoidElements,
} from "./constants.js";
import { sanitizeTemplateString } from "./sanitizeTemplateString.js";
import { regex_is_valid_identifier } from "../../patterns.js";
import { filters } from "../../../../internal/client/runtime/filters.js";
import { escapeHtml } from "../../../escaping.js";

/**
 * This function ensures visitor sets don't accidentally clobber each other
 * @param  {...any} array
 * @returns {any}
 */
function combineVisitors(...array) {
    /** @type {Record<string, any>} */
    const visitors = {};

    for (const member of array) {
        for (const key in member) {
            if (visitors[key]) {
                throw new Error(`Duplicate visitor: ${key}`);
            }

            // @ts-ignore
            visitors[key] = member[key];
        }
    }

    return visitors;
}

/**
 * @type {import("../types.js").Transformer}
 */
export function renderDom(ast, analysis, options, meta) {
    /**
     * @type {import("./types.js").ComponentClientTransformState}
     */
    const state = {
        scope: analysis.template.scope,
        scopes: analysis.template.scopes,
        options,
        hoisted: [b.importAll("$", "@pivotass/zvelte/internal/client")],
        node: /** @type {any} */ (null), // populated by the root node
        nonPropVars: [],
        nonPropSources: [],
        nonPropGetters: [],
        ignoreScope: false,
        // these should be set by create_block - if they're called outside, it's a bug
        get before_init() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "before_init.push should not be called outside create_block"
                );
            };
            return a;
        },
        get init() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "init.push should not be called outside create_block"
                );
            };
            return a;
        },
        get update() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "update.push should not be called outside create_block"
                );
            };
            return a;
        },
        get after_update() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "after_update.push should not be called outside create_block"
                );
            };
            return a;
        },
        get template() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "template.push should not be called outside create_block"
                );
            };
            return a;
        },
        get locations() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "locations.push should not be called outside create_block"
                );
            };
            return a;
        },
        legacyReactiveStatements: new Map(),
        metadata: {
            context: {
                template_needs_import_node: false,
                template_contains_script_tag: false,
            },
            namespace: options.namespace,
            bound_contenteditable: false,
        },
        events: new Set(),
        preserve_whitespace: options.preserveWhitespace,
        public_state: new Map(),
        private_state: new Map(),
        in_constructor: false,
    };

    // @ts-ignore
    const template = /** @type {import('estree').Program} */ (
        walk(
            /** @type {import('#ast').ZvelteNode} */ (analysis.template.ast),
            state,
            combineVisitors(
                setScope(analysis.template.scopes),
                templateVisitors
            )
        )
    );

    const componentBlock = b.block(
        /** @type {import('estree').Statement[]} */ (template.body)
    );

    if (options.hasJS) {
        state.hoisted.unshift(
            b.importAll(
                "js",
                `./${options.filename.replace(/\.[^\.]*$/, ".js")}`
            )
        );

        componentBlock.body.unshift(
            b.stmt(
                b.assignment(
                    "=",
                    b.id("$$props"),
                    b.call("$.proxy", b.id("$$props"))
                )
            ),
            b.stmt(b.call("$.push", b.id("$$props"), b.true)),
            b.const("$$els", b.object([])),
            b.const(
                "$$scope",
                b.logical(b.optionalCall("js.scope"), "??", b.object([]))
            ),
            b.const(
                "$$methods",
                b.logical(
                    b.optionalCall(
                        "js.default",
                        b.object([
                            b.prop("init", b.id("props"), b.id("$$props")),
                            b.prop("init", b.id("scope"), b.id("$$scope")),
                            b.prop("init", b.id("els"), b.id("$$els")),
                        ])
                    ),
                    "??",
                    b.object([])
                )
            ),
            b.const("$$scopes", b.array([b.id("$$scope"), b.id("$$props")]))
        );

        componentBlock.body.push(b.return(b.call("$.pop", b.id("$$methods"))));
    }

    /**
     * @type {(import("estree").Statement | import("estree").ModuleDeclaration | import("estree").Directive)[]}
     */
    const body = [...state.hoisted];

    const component = b.function_declaration(
        b.id(options.filename.replace(/\.[^\.]*$/, "")),
        [b.id("$$anchor"), b.id("$$props")],
        componentBlock
    );

    body.push(b.exportDefault(component));

    body.push(
        b.exportNamed(
            b.function_declaration(
                b.id("mount"),
                [b.id("args")],
                b.block([
                    b.return(b.call("$.mount", component.id, b.id("args"))),
                ])
            )
        )
    );

    return print({
        type: "Program",
        sourceType: "module",
        body,
    });
}

/**
 * Creates a new block which looks roughly like this:
 * ```js
 * // hoisted:
 * const block_name = $.template(`...`);
 *
 * // for the main block:
 * const id = block_name();
 * // init stuff and possibly render effect
 * $.append($$anchor, id);
 * ```
 * Adds the hoisted parts to `context.state.hoisted` and returns the statements of the main block.
 * @param {import('#ast').ZvelteNode} parent
 * @param {string} name
 * @param {import('#ast').ZvelteNode[]} nodes
 * @param {import("./types.js").ComponentContext} context
 * @returns {import('estree').Statement[]}
 */
function createBlock(parent, name, nodes, context) {
    const namespace = "html";

    const { hoisted, trimmed } = cleanNodes(
        parent,
        nodes,
        context.path,
        namespace,
        context.state.options.preserveWhitespace,
        context.state.options.preserveComments
    );

    if (hoisted.length === 0 && trimmed.length === 0) {
        return [];
    }

    /** @type {import('estree').Statement[]} */
    const body = [];

    /** @type {import('./types.js').ComponentClientTransformState} */
    const state = {
        ...context.state,
        before_init: [],
        init: [],
        update: [],
        after_update: [],
        template: [],
        locations: [],
        metadata: {
            context: {
                template_needs_import_node: false,
                template_contains_script_tag: false,
            },
            namespace,
            bound_contenteditable: context.state.metadata.bound_contenteditable,
        },
    };

    const templateName = context.state.scope.root.unique(name);
    const nodeId = (context.state.node = b.id("fragment"));

    state.before_init.push(b.const(nodeId, b.call(templateName)));
    state.after_update.push(b.call("$.append", b.id("$$anchor"), nodeId));

    for (const node of hoisted) {
        context.visit(node, state);
    }

    processChildren(
        trimmed,
        (isText) =>
            isText
                ? b.call("$.first_child", nodeId, b.true)
                : b.call("$.first_child", nodeId),
        {
            ...context,
            state,
        }
    );

    // adds the 'const root = $.template(`...`, true)'
    state.hoisted.push(
        b.const(
            templateName,
            b.call(
                "$.template",
                b.template([b.templateElement(state.template.join(""))], []),
                b.true
            )
        )
    );

    body.push(...state.before_init);
    body.push(...state.init);
    body.push(...state.update);
    body.push(...state.after_update);

    return body;
}

/**
 * Processes an array of template nodes, joining sibling text/expression nodes
 * (e.g. `{a} b {c}`) into a single update function. Along the way it creates
 * corresponding template node references these updates are applied to.
 *
 * @param {import('#ast').ZvelteNode[]} nodes
 * @param {(is_text: boolean) => import('estree').Expression} expression
 * @param {import('./types.js').ComponentContext} context
 */
function processChildren(nodes, expression, { visit, state }) {
    /** @typedef {Array<import('#ast').Text | import('#ast').ExpressionTag>} Sequence */

    /** @type {Sequence} */
    let sequence = [];

    /**
     * @param {Sequence} sequence
     */
    function flushSequence(sequence) {
        if (sequence.length === 1 && sequence[0].type === "Text") {
            const prev = expression;
            expression = () => b.call("$.sibling", prev(true));
            state.template.push(sequence[0].data);
        } else {
            const id = b.id(state.scope.generate("text"));
            state.template.push(" ");
            state.init.push(b.const(id, expression(true)));

            const value = serializeAttributeValue(sequence, { visit, state });

            state.init.push(
                b.call(
                    "$.template_effect",
                    b.thunk(b.call("$.set_text", id, value))
                )
            );
        }
    }

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        if (node.type === "Text" || node.type === "ExpressionTag") {
            sequence.push(node);
        } else {
            if (node.type === "Variable") {
                const name = /** @type {import("estree").Pattern} */ (
                    visit(node.name, state)
                );

                const value = /** @type {import("estree").Expression} */ (
                    visit(node.value, state)
                );

                const assign = b.assignment("=", name, value);

                state.init.push(b.stmt(assign));
            }

            if (sequence.length > 0) {
                flushSequence(sequence);
                sequence = [];
            }

            if (node.type === "SnippetBlock") {
                // These nodes do not contribute to the sibling/child tree
                // TODO what about e.g. ConstTag and all the other things that
                // get hoisted inside clean_nodes?
                visit(node, state);
            } else if (node.type !== "Variable") {
                const id = getNodeId(
                    expression(false),
                    state,
                    node.type === "RegularElement" ? node.name : "node"
                );

                expression = (isText) =>
                    isText
                        ? b.call("$.sibling", id, b.true)
                        : b.call("$.sibling", id);

                visit(node, {
                    ...state,
                    node: id,
                });
            }
        }
    }

    if (sequence.length > 0) {
        flushSequence(sequence);
    }
}

/**
 * @type {import("./types.js").ComponentVisitors}
 */
const templateVisitors = {
    // @ts-ignore
    Fragment(node, context) {
        const body = createBlock(node, "root", node.nodes, context);
        return b.block(body);
    },

    Comment(node, { state }) {
        state.template.push(`<!--${node.data}-->`);
    },

    RegularElement(node, context) {
        context.state.template.push(`<${node.name}`);

        /** @type {(import("#ast").SpreadAttribute | import("#ast").Attribute | import("#ast").ClassDirective)[]} */
        const spreadAttributes = [];
        const hasSpread = node.attributes.some(
            (a) => a.type === "SpreadAttribute"
        );

        /** @type {(import("#ast").ClassDirective | import("#ast").Attribute)[]} */
        const classAttributes = [];

        for (const attr of node.attributes) {
            switch (attr.type) {
                case "SpreadAttribute":
                    spreadAttributes.push(attr);
                    break;

                case "Attribute": {
                    if (hasSpread) {
                        spreadAttributes.push(attr);
                        break;
                    }

                    if (attr.name === "class") {
                        classAttributes.push(attr);
                        break;
                    }

                    if (attr.value === true) {
                        context.state.template.push(` ${attr.name}`);
                    } else if (
                        attr.value.length === 1 &&
                        attr.value[0].type === "Text" &&
                        attr.value[0].data
                    ) {
                        context.state.template.push(
                            ` ${attr.name}="${escapeHtml(
                                attr.value[0].data,
                                true
                            )}"`
                        );
                    } else {
                        const expression = serializeAttributeValue(
                            attr.value,
                            context
                        );

                        /** @type {import("estree").Expression} */
                        let setter = b.call(
                            "$.set_attribute",
                            context.state.node,
                            b.literal(attr.name),
                            expression
                        );

                        if (DOMBooleanAttributes.includes(attr.name)) {
                            const name =
                                AttributeAliases[attr.name] ?? attr.name;
                            setter = b.assignment(
                                "=",
                                b.member(context.state.node, b.id(name)),
                                expression
                            );
                        }

                        const statement =
                            expression.type === "Literal"
                                ? setter
                                : b.call("$.template_effect", b.thunk(setter));

                        context.state.init.push(statement);
                    }
                    break;
                }

                case "BindDirective": {
                    const id =
                        /** @type {import("estree").Identifier | import("estree").MemberExpression} */ (
                            context.visit(attr.expression)
                        );

                    const get = b.thunk(id);
                    const set = b.arrow(
                        [b.id("$$value")],
                        b.assignment("=", id, b.id("$$value"))
                    );

                    switch (attr.name) {
                        case "value": {
                            const call = b.call(
                                "$.bind_value",
                                context.state.node,
                                get,
                                set
                            );

                            context.state.init.push(call);
                            break;
                        }
                        case "this": {
                            if (!context.state.options.hasJS) break;

                            const setId =
                                /** @type {import("estree").Identifier | import("estree").MemberExpression} */ (
                                    context.visit(attr.expression, {
                                        ...context.state,
                                        ignoreScope: true,
                                    })
                                );

                            const set = b.arrow(
                                [b.id("$$el")],
                                b.assignment(
                                    "=",
                                    b.member(b.id("$$els"), setId),
                                    b.id("$$el")
                                )
                            );

                            const call = b.call(
                                "$.bind_this",
                                context.state.node,
                                set,
                                get
                            );

                            context.state.init.push(call);
                            break;
                        }

                        case "checked": {
                            const call = b.call(
                                "$.bind_checked",
                                context.state.node,
                                get,
                                set
                            );

                            context.state.init.push(call);
                            break;
                        }

                        default:
                            throw new Error(`bind:${attr.name} not handled`);
                    }
                    break;
                }

                case "OnDirective": {
                    let call;
                    if (attr.expression) {
                        let handler =
                            /** @type {import('estree').Expression} */ (
                                context.visit(attr.expression)
                            );
                        if (
                            attr.expression.type !==
                                "ArrowFunctionExpression" &&
                            attr.expression.type !== "CallExpression" &&
                            attr.expression.type !== "FilterExpression"
                        ) {
                            handler = b.function(
                                null,
                                [b.rest(b.id("$$args"))],
                                b.block([
                                    b.const("$$callback", handler),
                                    b.return(
                                        b.call(
                                            "$$callback?.apply",
                                            b.id("this"),
                                            b.id("$$args")
                                        )
                                    ),
                                ])
                            );
                        }

                        call = b.call(
                            "$.event",
                            b.literal(attr.name),
                            context.state.node,
                            handler,
                            b.false
                        );
                    } else {
                        call = b.call(
                            "$.event",
                            b.literal(attr.name),
                            context.state.node,
                            b.function(
                                null,
                                [b.id("$$arg")],
                                b.block([
                                    b.stmt(
                                        b.call(
                                            "$.bubble_event.call",
                                            b.id("this"),
                                            b.id("$$props"),
                                            b.id("$$arg")
                                        )
                                    ),
                                ])
                            )
                        );
                    }

                    context.state.init.push(call);
                    break;
                }

                case "ClassDirective": {
                    if (hasSpread) {
                        spreadAttributes.push(attr);
                    } else {
                        classAttributes.push(attr);
                    }
                    break;
                }

                case "TransitionDirective": {
                    let flag = 0;

                    if (attr.intro) flag += TRANSITION_IN;
                    if (attr.outro) flag += TRANSITION_OUT;

                    if (attr.modifiers.includes("global")) {
                        flag += TRANSITION_GLOBAL;
                    }

                    const transition =
                        /** @type {import("estree").Expression} */ (
                            context.visit({
                                type: "Identifier",
                                name: attr.name,
                                start: attr.start + 3,
                                end: attr.start + 3 + attr.name.length,
                            })
                        );

                    const call = b.call(
                        "$.transition",
                        b.literal(flag),
                        context.state.node,
                        b.thunk(transition)
                    );

                    if (attr.expression) {
                        const expression =
                            /** @type {import("estree").Expression} */ (
                                context.visit(attr.expression)
                            );

                        call.arguments.push(b.thunk(expression));
                    }

                    context.state.init.push(call);
                    break;
                }
            }
        }

        if (spreadAttributes.length) {
            const cacheId = b.id(context.state.scope.generate("attributes"));
            context.state.init.push(b.declaration("let", cacheId));

            /**
             * @type {(import("estree").SpreadElement | import("estree").Property)[]}
             */
            const properties = [];
            /**
             * @type {import("estree").ExpressionStatement[]}
             */
            const statements = [];

            for (const attr of spreadAttributes) {
                if (attr.type === "SpreadAttribute") {
                    const expression =
                        /** @type {import("estree").Expression} */ (
                            context.visit(attr.expression)
                        );
                    properties.push(b.spread(expression));
                } else if (attr.type === "ClassDirective") {
                    const expression =
                        /** @type {import("estree").Expression} */ (
                            context.visit(attr.expression)
                        );

                    statements.push(
                        b.stmt(
                            b.call(
                                "$.toggle_class",
                                context.state.node,
                                b.literal(attr.name),
                                expression
                            )
                        )
                    );
                } else if (attr.type === "Attribute") {
                    const expression = serializeAttributeValue(
                        attr.value,
                        context
                    );

                    const name = AttributeAliases[attr.name] ?? attr.name;

                    properties.push(
                        b.prop(
                            "init",
                            name.includes("-") ? b.literal(name) : b.id(name),
                            expression
                        )
                    );
                }
            }

            const call = b.call(
                "$.set_attributes",
                context.state.node,
                cacheId,
                b.object(properties),
                b.true,
                b.literal("")
            );

            statements.unshift(b.stmt(b.assignment("=", cacheId, call)));

            const effect = b.call(
                "$.template_effect",
                b.thunk(
                    statements.length === 1
                        ? statements[0].expression
                        : b.block(statements)
                )
            );

            context.state.init.push(effect);
        }

        if (classAttributes.length) {
            /**
             * @type {import("estree").ExpressionStatement[]}
             */
            const statements = [];
            let isDynamic = false;

            /**
             * @param {import("estree").Expression} expression
             */
            function checkIsDynamic(expression) {
                walk(
                    expression,
                    {},
                    {
                        Identifier() {
                            isDynamic = true;
                        },
                    }
                );
            }

            for (const attr of classAttributes) {
                if (attr.type === "ClassDirective") {
                    const expression =
                        /** @type {import("estree").Expression} */ (
                            context.visit(attr.expression)
                        );

                    checkIsDynamic(expression);

                    const call = b.call(
                        "$.toggle_class",
                        context.state.node,
                        b.literal(attr.name),
                        expression
                    );

                    statements.push(b.stmt(call));
                } else {
                    const expression = serializeAttributeValue(
                        attr.value,
                        context
                    );

                    checkIsDynamic(expression);

                    const call = b.call(
                        "$.set_class",
                        context.state.node,
                        expression
                    );

                    statements.push(b.stmt(call));
                }
            }

            if (isDynamic) {
                const call = b.call(
                    "$.template_effect",
                    b.thunk(
                        statements.length === 1
                            ? statements[0].expression
                            : b.block(statements)
                    )
                );
                context.state.init.push(call);
            } else {
                context.state.init.push(...statements);
            }
        }

        context.state.template.push(">");

        const { hoisted, trimmed } = cleanNodes(
            node,
            node.fragment.nodes,
            context.path,
            "html",
            context.state.options.preserveWhitespace,
            context.state.options.preserveComments
        );

        for (const node of hoisted) {
            context.visit(node);
        }

        processChildren(
            trimmed,
            () =>
                b.call(
                    "$.child",
                    node.name === "template"
                        ? b.member(context.state.node, b.id("content"))
                        : context.state.node
                ),
            context
        );

        if (!VoidElements.includes(node.name)) {
            context.state.template.push(`</${node.name}>`);
        }
    },

    SnippetBlock(node, { visit, state }) {
        const args = [b.id("$$anchor")];
        const params = [];

        for (const param of node.parameters) {
            params.push(param.name);
            args.push(b.id(param.name));
        }

        state.init.push(
            b.assignment(
                "=",
                /** @type {import("estree").Pattern} */ (
                    visit(node.expression)
                ),
                b.arrow(
                    args,
                    // @ts-expect-error
                    /** @type {import("estree").BlockStatement} */ (
                        visit(node.body, {
                            ...state,
                            nonPropGetters: [
                                ...state.nonPropGetters,
                                ...params,
                            ],
                        })
                    )
                )
            )
        );
    },

    RenderTag(node, { visit, state }) {
        const callee = /** @type {import("estree").Expression} */ (
            visit(
                node.expression.type === "CallExpression"
                    ? node.expression.callee
                    : node.expression.name
            )
        );

        const call = b.call("$.snippet", b.thunk(callee), state.node);

        for (const arg of node.expression.arguments) {
            call.arguments.push(
                b.thunk(/** @type {import("estree").Expression} */ (visit(arg)))
            );
        }

        state.template.push("<!>");
        state.init.push(b.stmt(call));
    },

    TransitionDirective(node, { state, visit }) {
        let flags = node.modifiers.includes("global") ? TRANSITION_GLOBAL : 0;
        if (node.intro) flags |= TRANSITION_IN;
        if (node.outro) flags |= TRANSITION_OUT;

        const args = [
            b.literal(flags),
            state.node,
            b.thunk(
                /** @type {import('estree').Expression} */ (
                    visit(parseDirectiveName(node.name))
                )
            ),
        ];

        if (node.expression) {
            args.push(
                b.thunk(
                    /** @type {import('estree').Expression} */ (
                        visit(node.expression)
                    )
                )
            );
        }

        state.init.push(b.stmt(b.call("$.transition", ...args)));
    },

    // @ts-ignore
    CallExpression(node, context) {
        return serializeFunction(node, context);
    },

    // @ts-ignore
    FilterExpression(node, context) {
        if (node.name.name in filters) {
            const args = [];

            for (const arg of node.arguments) {
                args.push(context.visit(arg));
            }

            const call = b.call(
                "$.filter",
                context.state.options.hasJS
                    ? b.id("$$scopes")
                    : b.array([b.id("$$props")]),
                b.literal(node.name.name)
            );

            return b.call(b.member(call, b.id(node.name.name)), ...args);
        } else {
            return serializeFunction(node, context);
        }
    },

    // @ts-ignore
    MemberExpression(node, { visit, state, path }) {
        const object = /** @type {import("estree").Expression} */ (
            visit(node.object)
        );

        const property = /** @type {import("estree").Expression} */ (
            visit(node.property)
        );

        let member = b.member(object, property, node.computed);

        if (
            !state.ignoreScope &&
            path.at(-1)?.type !== "MemberExpression" &&
            member.object.type === "Identifier"
        ) {
            if (state.nonPropSources.includes(member.object.name)) {
                member = b.member(b.call("$.get", member.object), property);
            } else if (state.nonPropGetters.includes(member.object.name)) {
                member = b.member(b.call(member.object), property);
            } else if (!state.nonPropVars.includes(member.object.name)) {
                member = b.member(
                    state.options.hasJS
                        ? b.call(
                              "$.scope",
                              b.id("$$scopes"),
                              b.literal(member.object.name),
                              b.id("$$scope")
                          )
                        : b.id("$$props"),
                    member
                );
            }
        }

        return member;
    },

    // @ts-ignore
    Identifier(node, { path, state }) {
        /** @type {import("estree").Expression} */
        let id = b.id(node.name);
        const parent = path[path.length - 1];

        if (
            !state.ignoreScope &&
            (parent.type !== "MemberExpression" || parent.computed)
        ) {
            if (state.nonPropSources.includes(id.name)) {
                id = b.call("$.get", id);
            } else if (state.nonPropGetters.includes(id.name)) {
                id = b.call(id);
            } else if (!state.nonPropVars.includes(id.name)) {
                id = b.member(
                    state.options.hasJS
                        ? b.call(
                              "$.scope",
                              b.id("$$scopes"),
                              b.literal(id.name),
                              b.id("$$scope")
                          )
                        : b.id("$$props"),
                    id
                );
            }
        }

        return id;
    },

    // @ts-expect-error
    InExpression(node, { visit }) {
        /**
         * @type {import("estree").Expression}
         */
        let expression = b.call("$.in", visit(node.left), visit(node.right));

        if (node.not) {
            expression = b.unary("!", expression);
        }

        return expression;
    },

    // @ts-expect-error
    IsExpression(node, { visit, state }) {
        if (node.right.type === "Identifier") {
            switch (node.right.name) {
                case "empty": {
                    const test = b.call("$.is_empty", visit(node.left));
                    if (node.not) return b.unary("!", test);
                    return test;
                }

                case "defined": {
                    if (node.left.type !== "Identifier") {
                        throw new Error(
                            `"... is${
                                node.not ? " not" : ""
                            } defined" expressions can only be done on an Identifier or a MemberExpression at ${
                                node.left.start
                            }`
                        );
                    }

                    if (state.options.hasJS) {
                        return b.binary(
                            b.call(
                                "$.scope",
                                b.id("$$scopes"),
                                b.literal(node.left.name)
                            ),
                            node.not ? "===" : "!==",
                            b.id("undefined")
                        );
                    }

                    const test = b.binary(
                        b.literal(node.left.name),
                        "in",
                        b.id("$$props")
                    );
                    if (node.not) return b.unary("!", test);
                    return test;
                }
            }
        } else if (node.right.type === "NullLiteral") {
            return b.binary(
                visit(node.left),
                node.not ? "!==" : "===",
                b.literal(null)
            );
        }

        throw new Error(
            `Unhandled kind of "IsExpression" at ${node.right.start}`
        );
    },

    // @ts-expect-error
    ArrowFunctionExpression(node, { state, visit }) {
        const vars = state.nonPropVars.slice();
        /** @type {import("estree").Pattern[]} */
        const params = node.params.map((p) => {
            vars.push(p.name);
            return {
                type: "Identifier",
                name: p.name,
            };
        });

        return b.arrow(
            params,
            /** @type {import('estree').Expression} */ (
                visit(node.body, { ...state, nonPropVars: vars })
            )
        );
    },

    // @ts-ignore
    NumericLiteral: (node) => b.literal(node.value),
    // @ts-ignore
    StringLiteral: (node) => b.literal(node.value),
    // @ts-ignore
    BooleanLiteral: (node) => b.literal(node.value),
    // @ts-ignore
    NullLiteral: (node) => b.literal(node.value),

    // @ts-ignore
    UnaryExpression(node, context) {
        const argument = /** @type {import("estree").Expression} */ (
            context.visit(node.argument)
        );

        return b.unary(node.operator === "not" ? "!" : node.operator, argument);
    },

    // @ts-ignore
    BinaryExpression(node, context) {
        /**
         * @type {import("estree").BinaryOperator}
         */
        let operator;

        let left = /** @type {import("estree").Expression} */ (
            context.visit(node.left)
        );

        let right = /** @type {import("estree").Expression} */ (
            context.visit(node.right)
        );

        switch (node.operator) {
            case "~": {
                if (node.left.type !== "StringLiteral")
                    left = b.call("String", left);

                if (node.right.type !== "StringLiteral")
                    right = b.call("String", right);

                operator = "+";
                break;
            }

            case "+": {
                if (node.left.type !== "NumericLiteral")
                    left = b.call("Number", left);

                if (node.right.type !== "NumericLiteral")
                    right = b.call("Number", right);
            }
            default:
                operator = node.operator;
                break;
        }

        return b.binary(left, operator, right);
    },

    // @ts-ignore
    LogicalExpression(node, context) {
        /**
         * @type {import("estree").LogicalOperator}
         */
        let operator;

        switch (node.operator) {
            case "or":
                operator = "||";
                break;

            case "and":
                operator = "&&";
                break;

            default:
                operator = node.operator;
                break;
        }

        return b.logical(
            /** @type {import("estree").Expression} */ (
                context.visit(node.left)
            ),
            operator,
            /** @type {import("estree").Expression} */ (
                context.visit(node.right)
            )
        );
    },

    // @ts-expect-error
    RangeExpression(node, context) {
        const array = b.array();

        const count = Math.abs(node.to.value - node.from.value);

        for (let i = 0; i < count; i++) {
            const add = node.step * i;
            array.elements.push(b.literal(node.from.value + add));
        }

        return array;
    },

    // @ts-expect-error
    ObjectExpression(node, context) {
        /** @type {Array<import('estree').Property | import('estree').SpreadElement>} */
        const properties = [];

        for (const prop of node.properties) {
            /** @type {import("estree").Expression} */
            // @ts-ignore
            const key =
                prop.key.type === "Identifier"
                    ? {
                          type: "Identifier",
                          name: prop.key.name,
                      }
                    : context.visit(prop.key);

            // @ts-ignore
            properties.push(b.prop("init", key, context.visit(prop.value)));
        }

        return b.object(properties);
    },

    Component(node, { state, path, visit }) {
        const parent = path[path.length - 1];
        state.template.push("<!>");

        const { hoisted, trimmed } = cleanNodes(
            parent,
            node.fragment.nodes,
            path,
            undefined,
            state.options.preserveWhitespace,
            state.options.preserveComments
        );

        /**
         * @type {Parameters<typeof b.object>[0]}
         */
        const properties = [];

        for (const child of hoisted) {
            visit(child);

            if (child.type === "SnippetBlock") {
                properties.push(
                    b.prop(
                        "init",
                        b.id(child.expression.name),
                        visit(child.expression)
                    )
                );
            }
        }

        let alreadyImported;

        for (const hoist of state.hoisted) {
            if (
                hoist.type === "ImportDeclaration" &&
                hoist.source.value === node.key.data &&
                hoist.specifiers[0].type === "ImportDefaultSpecifier"
            ) {
                alreadyImported = hoist.specifiers[0].local;
            }
        }

        const id =
            alreadyImported ??
            state.scope.root.unique(
                (/([^/]+)$/.exec(node.key.data)?.[1] ?? "component").replace(
                    /\.\w+$/,
                    ""
                )
            );

        if (!alreadyImported) {
            state.hoisted.unshift(
                b.import(node.key.data, {
                    type: "ImportDefaultSpecifier",
                    local: id,
                })
            );
        }

        state.init.push(b.call(id, state.node, b.object(properties)));
    },

    ZvelteComponent(node, { visit, state }) {
        state.template.push("<!>");

        const block = b.block([]);
        const call = b.call(
            "$.component",
            b.thunk(visit(node.expression)),
            b.arrow([b.id("$$component")], block)
        );

        /**
         * @type {import('estree').Property[]}
         */
        const props = [];

        walk(/** @type {import("#ast").ZvelteNode} */ (node), null, {
            Attribute(attr) {
                /**
                 * @type {import('estree').Expression}
                 */
                let expression = b.true;
                let canSet = false;

                if (attr.value !== true) {
                    if (attr.value.length === 1) {
                        const n = attr.value[0];
                        if (n.type === "Text") {
                            expression = b.literal(n.data);
                        } else {
                            expression = visit(n.expression);
                            canSet =
                                n.expression.type === "Identifier" ||
                                n.expression.type === "MemberExpression";
                        }
                    } else {
                        /** @type {import('estree').TemplateElement[]} */
                        const elements = [];
                        /** @type {import('estree').Expression[]} */
                        const expressions = [];

                        for (let i = 0; i < attr.value.length; i++) {
                            const n = attr.value[i];
                            const tail = i === attr.value.length - 1;

                            if (n.type === "Text") {
                                const el = b.templateElement();
                                el.value.raw = n.data;
                                el.tail = tail;
                                elements.push(el);
                            } else {
                                if (i === 0) {
                                    elements.push(b.templateElement());
                                }

                                expressions.push(visit(n.expression));
                                if (tail) {
                                    const el = b.templateElement();
                                    el.tail = tail;
                                    elements.push(el);
                                }
                            }
                        }

                        expression = b.template(elements, expressions);
                    }
                }

                props.push(
                    b.prop(
                        "get",
                        b.id(attr.name),
                        b.function(null, [], b.block([b.return(expression)]))
                    )
                );

                if (canSet) {
                    props.push(
                        b.prop(
                            "set",
                            b.id(attr.name),
                            b.function(
                                null,
                                [b.id("$$value")],
                                b.block([
                                    b.stmt(
                                        b.assignment(
                                            "=",
                                            // @ts-ignore
                                            expression,
                                            b.id("$$value")
                                        )
                                    ),
                                ])
                            )
                        )
                    );
                }
            },
        });

        block.body.push(
            b.stmt(b.call("$$component", state.node, b.object(props)))
        );

        state.init.push(b.stmt(call));
    },

    HtmlTag(node, { state, visit }) {
        state.template.push("<!>");

        state.init.push(
            b.call(
                "$.html",
                state.node,
                b.thunk(visit(node.expression)),
                b.false,
                b.false
            )
        );
    },

    IfBlock(node, { state, visit }) {
        state.template.push("<!>");

        const call = b.call(
            "$.if",
            state.node,
            b.thunk(visit(node.test)),
            b.arrow([b.id("$$anchor")], visit(node.consequent))
        );

        if (node.alternate) {
            call.arguments.push(
                b.arrow([b.id("$$anchor")], visit(node.alternate))
            );
        }

        if (node.elseif) {
            call.arguments.push(b.true);
        }

        state.init.push(call);
    },

    ForBlock(node, { state, visit, path }) {
        state.template.push("<!>");

        const call = b.call("$.each", state.node);

        let flags = EACH_ITEM_REACTIVE | EACH_INDEX_REACTIVE;
        /**
         * @type {import('estree').Expression}
         */
        let key = b.id("$.index");

        if (node.key !== null) {
            flags |= EACH_KEYED;

            key = b.arrow(
                [b.id("$$key"), b.id("$$index")],
                b.call("$.unwrap", b.id("$$key"))
            );
        }

        const nonPropSources = [...state.nonPropSources, node.context.name];

        if (node.index) {
            nonPropSources.push(node.index.name);
        }

        // @ts-ignore
        const body = /** @type {import('estree').BlockStatement} */ (
            visit(node.body, {
                ...state,
                nonPropVars: [...state.nonPropVars, "loop"],
                nonPropSources,
            })
        );

        const isInForBlock = path.some((node) => node.type === "ForBlock");

        const array = b.call("$.iterable", visit(node.expression));
        const unwrapIndex = b.call("$.unwrap", b.id("$$index"));
        const loopInit = [];

        if (isInForBlock) {
            state.init.push(b.const(b.id("parentLoop"), b.id("loop")));
        }

        loopInit.push(
            b.const(
                b.id("loop"),
                b.call(
                    "$.loop",
                    b.thunk(unwrapIndex),
                    b.thunk(array),
                    isInForBlock ? b.id("parentLoop") : b.literal(null)
                )
            )
        );

        if (node.index) {
            const expression = b.member(
                b.call("Object.keys", visit(node.expression)),
                unwrapIndex,
                true
            );

            loopInit.push(
                b.const(
                    node.index.name,
                    b.call("$.derived", b.thunk(expression))
                )
            );
        }

        body.body.unshift(...loopInit);

        call.arguments.push(
            b.literal(flags),
            b.thunk(array),
            key,
            b.arrow(
                [b.id("$$anchor"), b.id(node.context.name), b.id("$$index")],
                body
            )
        );

        state.init.push(call);
    },

    KeyBlock(node, { visit, state }) {
        const call = b.call(
            "$.key",
            state.node,
            b.thunk(visit(node.expression)),
            b.arrow([b.id("$$anchor")], visit(node.fragment))
        );

        state.template.push("<!>");
        state.init.push(call);
    },
};

/**
 * @param {import('estree').Expression} expression
 * @param {import('./types.js').ComponentClientTransformState} state
 * @param {string} name
 */
function getNodeId(expression, state, name) {
    let id = expression;

    if (id.type !== "Identifier") {
        id = b.id(state.scope.generate(name));

        state.init.push(b.const(id, expression));
    }
    return id;
}

/**
 * @param {Array<import('#ast').Text | import('#ast').ExpressionTag | import("#ast").VariableTag>} values
 * @param {(node: import('#ast').ZvelteNode) => any} visit
 * @param {import("./types.js").ComponentClientTransformState} state
 * @returns {[boolean, import('estree').TemplateLiteral, import('estree').AssignmentExpression[]]}
 */
function serializeTemplateLiteral(values, visit, state) {
    /** @type {import('estree').TemplateElement[]} */
    const quasis = [];

    /** @type {import('estree').Expression[]} */
    const expressions = [];

    /** @type {import("estree").AssignmentExpression[]} */
    const assignments = [];

    let contains_call_expression = false;
    let contains_multiple_call_expression = false;
    quasis.push(b.quasi(""));

    for (let i = 0; i < values.length; i++) {
        const node = values[i];

        if (
            node.type === "ExpressionTag" &&
            walk(
                node.expression,
                {},
                {
                    // @ts-ignore
                    FilterExpression: () => true,
                    // @ts-ignore
                    CallExpression: () => true,
                }
            )
        ) {
            if (contains_call_expression) {
                contains_multiple_call_expression = true;
            }
            contains_call_expression = true;
        }
    }

    for (let i = 0; i < values.length; i++) {
        const node = values[i];

        if (node.type === "Text") {
            const last = /** @type {import('estree').TemplateElement} */ (
                quasis.at(-1)
            );
            last.value.raw += sanitizeTemplateString(node.data);
        } else if (node.type === "Variable") {
            assignments.push(
                b.assignment("=", visit(node.name), visit(node.value))
            );
        } else if (
            node.type === "ExpressionTag" &&
            (node.expression.type === "NullLiteral" ||
                node.expression.type === "StringLiteral" ||
                node.expression.type === "BooleanLiteral" ||
                node.expression.type === "NumericLiteral")
        ) {
            const last = /** @type {import('estree').TemplateElement} */ (
                quasis.at(-1)
            );
            if (node.expression.value != null) {
                last.value.raw += sanitizeTemplateString(
                    node.expression.value + ""
                );
            }
        } else {
            if (contains_multiple_call_expression) {
                const id = b.id(state.scope.generate("stringified_text"));

                state.init.push(
                    b.const(
                        id,
                        b.call(
                            "$.derived",
                            b.thunk(
                                b.logical(
                                    /** @type {import('estree').Expression} */ (
                                        visit(node.expression)
                                    ),
                                    "??",
                                    b.literal("")
                                )
                            )
                        )
                    )
                );
                expressions.push(b.call("$.get", id));
            } else {
                expressions.push(
                    b.logical(
                        /** @type {import('estree').Expression} */ (
                            visit(node.expression)
                        ),
                        "??",
                        b.literal("")
                    )
                );
            }
            quasis.push(b.quasi("", i + 1 === values.length));
        }
    }

    // TODO instead of this tuple, return a `{ dynamic, complex, value }` object. will DRY stuff out
    return [
        contains_call_expression,
        b.template(quasis, expressions),
        assignments,
    ];
}

/**
 * Serializes an event handler function of the `on:` directive or an attribute starting with `on`
 * @param {{name: string; modifiers: string[]; expression: import('estree').Expression | null; delegated?: import('#compiler').DelegatedEvent | null; }} node
 * @param {import('./types.js').ComponentContext} context
 */
function serializeEvent(node, { visit, state }) {
    const expression = node.expression ?? {
        type: "Identifier",
        name: node.name,
        start: -1,
        end: -1,
    };

    let listener;

    if (expression.type === "ArrowFunctionExpression") {
        listener = visit(expression);
    } else {
        listener = b.function(
            null,
            [b.rest(b.id("$$args"))],
            b.block([
                b.const("$$callback", visit(expression)),
                b.return(
                    b.call(
                        b.member(
                            b.id("$$callback"),
                            b.id("apply"),
                            false,
                            true
                        ),
                        b.id("this"),
                        b.id("$$args")
                    )
                ),
            ])
        );
    }

    state.init.push(
        b.call("$.event", b.literal(node.name), state.node, listener)
    );
}

/**
 * @param {import("#ast").Attribute["value"]} attributeValue
 * @param {Pick<import('./types.js').ComponentContext, "visit" | "state">} context
 * @returns {import("estree").Expression}
 */
function serializeAttributeValue(attributeValue, { visit, state }) {
    if (attributeValue === true) return b.true;

    /** @type {import("estree").TemplateElement[]} */
    const elements = [];
    /** @type {import("estree").Expression[]} */
    const expressions = [];

    for (let i = 0; i < attributeValue.length; i++) {
        const node = attributeValue[i];
        const tail = i === attributeValue.length - 1;

        if (node.type === "Text") {
            elements.push(b.templateElement(node.data, tail));
        } else if (node.type === "ExpressionTag") {
            if (i === 0 && attributeValue.length > 1) {
                elements.push(b.templateElement("", false));
            }

            let expression = /** @type {import("estree").Expression} */ (
                visit(node.expression, state)
            );

            if (expression.type !== "Literal") {
                expression = b.logical(expression, "??", b.literal(""));
            }

            expressions.push(expression);

            if (tail && elements.length) {
                elements.push(b.templateElement());
            }
        }
    }

    return elements.length
        ? elements.length === 1
            ? b.literal(elements[0].value.raw)
            : b.template(elements, expressions)
        : expressions[0];
}

/**
 * For unfortunate legacy reasons, directive names can look like this `use:a.b-c`
 * This turns that string into a member expression
 * @param {string} name
 * @returns {import("#ast").Identifier | import("#ast").MemberExpression}
 */
function parseDirectiveName(name) {
    // this allow for accessing members of an object
    const parts = name.split(".");
    let part = /** @type {string} */ (parts.shift());

    /** @type {import('#ast').Identifier | import('#ast').MemberExpression} */
    let expression = {
        type: "Identifier",
        name: part,
        start: -1,
        end: -1,
    };

    while ((part = /** @type {string} */ (parts.shift()))) {
        const computed = !regex_is_valid_identifier.test(part);
        expression = {
            type: "MemberExpression",
            object: expression,
            ...(computed === true
                ? {
                      computed,
                      property: {
                          type: "StringLiteral",
                          value: part,
                          raw: `"${part}"`,
                          start: -1,
                          end: -1,
                      },
                  }
                : {
                      computed,
                      property: {
                          type: "Identifier",
                          name: part,
                          start: -1,
                          end: -1,
                      },
                  }),
            start: -1,
            end: -1,
        };
    }

    return expression;
}

/**
 * @param {import("#ast").FilterExpression | import("#ast").CallExpression} node
 * @param {import("./types.js").ComponentContext} context
 */
function serializeFunction(node, context) {
    const name = /** @type {import("estree").Expression} */ (
        context.visit(
            node.type === "FilterExpression" ? node.name : node.callee
        )
    );

    const args = node.arguments.map(
        (arg) => /** @type {import("estree").Expression} */ (context.visit(arg))
    );

    return b.call(name, ...args);
}
