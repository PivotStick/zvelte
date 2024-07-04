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
import { setScope } from "./scope.js";
import {
    AttributeAliases,
    DOMProperties,
    SVGElements,
    VoidElements,
} from "../constants.js";
import { regex_is_valid_identifier } from "../../patterns.js";
import { filters } from "../../../../internal/client/runtime/filters.js";
import { escapeHtml } from "../../../escaping.js";
import { renderStylesheet } from "../css/index.js";
import { buildLoadWrapper } from "./buildLoadWrapper.js";

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
        els: false,
        // these should be set by create_block - if they're called outside, it's a bug
        get before_init() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "before_init.push should not be called outside create_block",
                );
            };
            return a;
        },
        get init() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "init.push should not be called outside create_block",
                );
            };
            return a;
        },
        get update() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "update.push should not be called outside create_block",
                );
            };
            return a;
        },
        get after_update() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "after_update.push should not be called outside create_block",
                );
            };
            return a;
        },
        get template() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "template.push should not be called outside create_block",
                );
            };
            return a;
        },
        get locations() {
            /** @type {any[]} */
            const a = [];
            a.push = () => {
                throw new Error(
                    "locations.push should not be called outside create_block",
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
    };

    if (analysis.css) {
        const result = renderStylesheet(analysis.css.code, analysis, {
            dev: false,
            filename: options.filename + ".css",
        });

        if (options.css === "injected") {
            state.hoisted.push(
                b.stmt(
                    b.call(
                        "$.append_styles",
                        b.literal(null),
                        b.literal(analysis.css.hash),
                        b.literal(result.code),
                    ),
                ),
            );
        }
    }

    // @ts-ignore
    const template = /** @type {import('estree').Program} */ (
        walk(
            /** @type {import('#ast').ZvelteNode} */ (analysis.template.ast),
            state,
            combineVisitors(
                setScope(analysis.template.scopes),
                templateVisitors,
            ),
        )
    );

    template.body.unshift(
        ...[...analysis.bindingGroups].map(([, id]) => b.var(id, b.array([]))),
    );

    const component = b.function_declaration(
        b.id(
            state.scope.generate(
                options.filename.replace(/\.[^\.]*$/, "").replace(/\./g, "_"),
            ),
        ),
        [b.id("$$anchor"), b.id("$$props")],
        b.block(/** @type {import('estree').Statement[]} */ (template.body)),
    );

    if (options.hasJS) {
        state.hoisted.unshift(
            b.importAll(
                "js",
                `./${options.filename.replace(/\.[^\.]*$/, ".js")}`,
            ),
        );

        const initArgs = b.object([
            b.prop("init", b.id("props"), b.id("$$props")),
            b.prop("init", b.id("scope"), b.id("$$scope")),
            b.prop("init", b.id("els"), b.id("$$els")),
        ]);

        component.body.body.unshift(
            b.stmt(
                b.assignment(
                    "=",
                    b.id("$$props"),
                    b.call("$.proxy", b.id("$$props")),
                ),
            ),
            b.stmt(b.call("$.push", b.id("$$props"), b.true)),
            b.var("$$els", b.object([])),
            b.var(
                "$$scope",
                b.logical(b.optionalCall("js.scope"), "??", b.object([])),
            ),
            b.var(
                "$$methods",
                b.logical(
                    b.optionalCall("js.default", initArgs),
                    "??",
                    b.object([]),
                ),
            ),
            b.var(
                "$$prop",
                b.call("$.scope", b.array([b.id("$$scope"), b.id("$$props")])),
            ),
        );

        component.body.body.push(b.return(b.call("$.pop", b.id("$$methods"))));

        if (options.async) {
            component.params.push(b.id("$$refresh"));
            initArgs.properties.push(
                b.prop("init", b.id("refresh"), b.id("$$refresh")),
            );
        }
    }

    /**
     * @type {(import("estree").Statement | import("estree").ModuleDeclaration | import("estree").Directive)[]}
     */
    const body = [...state.hoisted];

    let exportDefaultId;

    if (options.async) {
        body.push(component);

        let pendingId;
        let errorId;

        if (options.async.pendingComponent) {
            pendingId = b.id("__$$pending");
            body.unshift(
                b.importDefault(pendingId.name, options.async.pendingComponent),
            );
        }

        if (options.async.errorComponent) {
            errorId = b.id("__$$pending");
            body.unshift(
                b.importDefault(errorId.name, options.async.errorComponent),
            );
        }

        const load = buildLoadWrapper({
            componentId: component.id,
            endpoint: options.async.endpoint,
            pendingId,
            errorId,
            propId: b.id(options.async.propId ?? "data"),
        });

        body.push(
            b.exportNamed(
                b.var(
                    "$$fetch",
                    b.call("$.create_load", b.literal(options.async.endpoint)),
                ),
            ),
        );
        body.push(b.exportDefault(load));
        exportDefaultId = load.id;
    } else {
        body.push(b.exportDefault(component));
        exportDefaultId = component.id;
    }

    body.push(
        b.exportNamed(
            b.function_declaration(
                b.id("mount"),
                [b.id("args")],
                b.block([
                    b.return(b.call("$.mount", exportDefaultId, b.id("args"))),
                ]),
            ),
        ),
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
        context.state.options.preserveComments,
    );

    if (hoisted.length === 0 && trimmed.length === 0) {
        return [];
    }

    const isSingleElement =
        trimmed.length === 1 && trimmed[0].type === "RegularElement";

    const is_single_child_not_needing_template =
        trimmed.length === 1 &&
        // @ts-expect-error
        (trimmed[0].type === "ZvelteFragment" ||
            // @ts-expect-error
            trimmed[0].type === "TitleElement");

    /** @type {import('estree').Statement[]} */
    const body = [];

    /** @type {import('estree').Statement | undefined} */
    let close = undefined;

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

    for (const node of hoisted) {
        context.visit(node, state);
    }

    /**
     * @param {import('estree').Identifier} template_name
     * @param {import('estree').Expression[]} args
     */
    const addTemplate = (template_name, args) => {
        let call = b.call(getTemplateFunction(namespace, state), ...args);
        context.state.hoisted.push(b.var(template_name, call));
    };

    if (isSingleElement) {
        const element = /** @type {import('#ast').RegularElement} */ (
            trimmed[0]
        );

        const id = b.id(context.state.scope.generate(element.name));

        context.visit(element, {
            ...state,
            node: id,
        });

        /** @type {import('estree').Expression[]} */
        const args = [b.template([b.quasi(state.template.join(""), true)], [])];

        if (state.metadata.context.template_needs_import_node) {
            args.push(b.literal(TEMPLATE_USE_IMPORT_NODE));
        }

        addTemplate(templateName, args);

        body.push(
            b.var(id, b.call(templateName)),
            ...state.before_init,
            ...state.init,
        );
        close = b.stmt(b.call("$.append", b.id("$$anchor"), id));
    } else if (is_single_child_not_needing_template) {
        context.visit(trimmed[0], state);
        body.push(...state.before_init, ...state.init);
    } else if (trimmed.length > 0) {
        const id = b.id(context.state.scope.generate("fragment"));

        const use_space_template =
            trimmed.some((node) => node.type === "ExpressionTag") &&
            trimmed.every(
                (node) => node.type === "Text" || node.type === "ExpressionTag",
            );

        if (use_space_template) {
            // special case — we can use `$.text` instead of creating a unique template
            const id = b.id(context.state.scope.generate("text"));

            processChildren(trimmed, () => id, false, {
                ...context,
                state,
            });

            body.push(
                b.var(id, b.call("$.text", b.id("$$anchor"))),
                ...state.before_init,
                ...state.init,
            );
            close = b.stmt(b.call("$.append", b.id("$$anchor"), id));
        } else {
            /** @type {(is_text: boolean) => import('estree').Expression} */
            const expression = (is_text) =>
                is_text
                    ? b.call("$.first_child", id, b.true)
                    : b.call("$.first_child", id);

            processChildren(trimmed, expression, false, { ...context, state });

            const use_comment_template =
                state.template.length === 1 && state.template[0] === "<!>";

            if (use_comment_template) {
                // special case — we can use `$.comment` instead of creating a unique template
                body.push(b.var(id, b.call("$.comment")));
            } else {
                let flags = TEMPLATE_FRAGMENT;

                if (state.metadata.context.template_needs_import_node) {
                    flags |= TEMPLATE_USE_IMPORT_NODE;
                }

                addTemplate(templateName, [
                    b.template([b.quasi(state.template.join(""), true)], []),
                    b.literal(flags),
                ]);

                body.push(b.var(id, b.call(templateName)));
            }

            body.push(...state.before_init, ...state.init);

            close = b.stmt(b.call("$.append", b.id("$$anchor"), id));
        }
    } else {
        body.push(...state.before_init, ...state.init);
    }

    if (state.update.length > 0) {
        body.push(...state.update);
    }

    body.push(...state.after_update);

    if (close !== undefined) {
        // It's important that close is the last statement in the block, as any previous statements
        // could contain element insertions into the template, which the close statement needs to
        // know of when constructing the list of current inner elements.
        body.push(close);
    }

    return body;
}

/**
 * Processes an array of template nodes, joining sibling text/expression nodes
 * (e.g. `{a} b {c}`) into a single update function. Along the way it creates
 * corresponding template node references these updates are applied to.
 *
 * @param {import('#ast').ZvelteNode[]} nodes
 * @param {(is_text: boolean) => import('estree').Expression} expression
 * @param {boolean} isElement
 * @param {import('./types.js').ComponentContext} context
 */
function processChildren(nodes, expression, isElement, { visit, state }) {
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
            state.init.push(b.var(id, expression(true)));

            expression = () => b.call("$.sibling", id);

            const value = serializeAttributeValue(sequence, true, {
                visit,
                state,
            });

            state.update.push(
                b.call(
                    "$.template_effect",
                    b.thunk(b.call("$.set_text", id, value)),
                ),
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

                state.update.push(b.stmt(assign));
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
                    node.type === "RegularElement" ? node.name : "node",
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
            (a) => a.type === "SpreadAttribute",
        );
        const hasBindGroup = node.attributes.some(
            (a) => a.type === "BindDirective" && a.name === "group",
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

                    if (hasBindGroup && attr.name === "value") {
                        break;
                    }

                    if (attr.name.toLowerCase() === "autofocus") {
                        const expression = serializeAttributeValue(
                            attr.value,
                            false,
                            context,
                        );
                        context.state.init.push(
                            b.stmt(
                                b.call(
                                    "$.autofocus",
                                    context.state.node,
                                    expression,
                                ),
                            ),
                        );
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
                                true,
                            )}"`,
                        );
                    } else {
                        const lowerName = attr.name.toLowerCase();

                        if (lowerName === "class") {
                            classAttributes.push(attr);
                            break;
                        }

                        const isProp = DOMProperties.includes(lowerName);
                        const expression = serializeAttributeValue(
                            attr.value,
                            !isProp,
                            context,
                        );

                        let method = "$.set_attribute";

                        if (node.name.includes("-")) {
                            method = "$.set_custom_element_data";
                        } else if (attr.name.startsWith("xlink:")) {
                            method = "$.set_xlink_attribute";
                        }

                        /** @type {import("estree").Expression} */
                        let setter = b.call(
                            method,
                            context.state.node,
                            b.literal(lowerName),
                            expression,
                        );

                        if (isProp) {
                            const name =
                                AttributeAliases[lowerName] ?? lowerName;
                            setter = b.assignment(
                                "=",
                                b.member(context.state.node, b.id(name)),
                                expression,
                            );
                        }

                        const statement =
                            expression.type === "Literal"
                                ? setter
                                : b.call("$.template_effect", b.thunk(setter));

                        context.state.update.push(b.stmt(statement));
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
                        b.assignment("=", id, b.id("$$value")),
                    );

                    switch (attr.name) {
                        case "value": {
                            const call = b.call(
                                "$.bind_value",
                                context.state.node,
                                get,
                                set,
                            );

                            context.state.update.push(b.stmt(call));
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
                                    b.id("$$el"),
                                ),
                            );

                            const call = b.call(
                                "$.bind_this",
                                context.state.node,
                                set,
                                get,
                            );

                            context.state.update.push(b.stmt(call));
                            break;
                        }

                        case "checked": {
                            const call = b.call(
                                "$.bind_checked",
                                context.state.node,
                                get,
                                set,
                            );

                            context.state.update.push(b.stmt(call));
                            break;
                        }

                        case "group": {
                            /** @type {import('estree').CallExpression[]} */
                            const indexes = [];
                            for (const parent_each_block of attr.metadata
                                .parent_each_blocks) {
                                indexes.push(
                                    b.call(
                                        "$.unwrap",
                                        parent_each_block.metadata.index,
                                    ),
                                );
                            }

                            const removeDefaults = b.call(
                                "$.remove_input_defaults",
                                context.state.node,
                            );

                            context.state.update.push(b.stmt(removeDefaults));

                            const valueAttr =
                                /** @type {import("#ast").Attribute=} */ (
                                    node.attributes.find(
                                        (a) =>
                                            a.type === "Attribute" &&
                                            a.name === "value",
                                    )
                                );

                            if (valueAttr) {
                                const expression = serializeAttributeValue(
                                    valueAttr.value,
                                    false,
                                    context,
                                );

                                const init = b.assignment(
                                    "=",
                                    b.member(context.state.node, b.id("value")),
                                    b.conditional(
                                        b.binary(
                                            b.literal(null),
                                            "==",
                                            b.assignment(
                                                "=",
                                                b.member(
                                                    context.state.node,
                                                    b.id("__value"),
                                                ),
                                                expression,
                                            ),
                                        ),
                                        b.literal(""),
                                        expression,
                                    ),
                                );
                                context.state.update.push(b.stmt(init));
                            }

                            const call = b.call(
                                "$.bind_group",
                                attr.metadata.binding_group_name,
                                b.array(indexes),
                                context.state.node,
                                get,
                                set,
                            );

                            context.state.after_update.push(b.stmt(call));
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
                                            b.id("$$args"),
                                        ),
                                    ),
                                ]),
                            );
                        }

                        for (const modifier of [...attr.modifiers].reverse()) {
                            handler = b.call(`$.${modifier}`, handler);
                        }

                        call = b.call(
                            "$.event",
                            b.literal(attr.name),
                            context.state.node,
                            handler,
                            b.false,
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
                                            b.id("$$arg"),
                                        ),
                                    ),
                                ]),
                            ),
                        );
                    }

                    context.state.update.push(b.stmt(call));
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
                        b.thunk(transition),
                    );

                    if (attr.expression) {
                        const expression =
                            /** @type {import("estree").Expression} */ (
                                context.visit(attr.expression)
                            );

                        call.arguments.push(b.thunk(expression));
                    }

                    context.state.update.push(b.stmt(call));
                    break;
                }

                case "UseDirective": {
                    const id = /** @type {import('estree').Expression} */ (
                        context.visit({
                            type: "Identifier",
                            name: attr.name,
                            start: attr.start + 3,
                            end: attr.start + 3 + attr.name.length,
                        })
                    );

                    const callAction = b.call(id, b.id("$$node"));
                    const caller = b.arrow([b.id("$$node")], callAction);
                    const call = b.call("$.action", context.state.node, caller);

                    if (attr.expression) {
                        const arg = b.id("$$action_arg");
                        caller.params.push(arg);
                        callAction.arguments.push(arg);
                        call.arguments.push(
                            b.thunk(
                                /** @type {import('estree').Expression} */ (
                                    context.visit(attr.expression)
                                ),
                            ),
                        );
                    }

                    context.state.update.push(b.stmt(call));
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
                                expression,
                            ),
                        ),
                    );
                } else if (attr.type === "Attribute") {
                    const expression = serializeAttributeValue(
                        attr.value,
                        true,
                        context,
                    );

                    const name = AttributeAliases[attr.name] ?? attr.name;

                    properties.push(
                        b.prop(
                            "init",
                            name.includes("-") ? b.literal(name) : b.id(name),
                            expression,
                        ),
                    );
                }
            }

            const call = b.call(
                "$.set_attributes",
                context.state.node,
                cacheId,
                b.object(properties),
                b.true,
                b.literal(""),
            );

            statements.unshift(b.stmt(b.assignment("=", cacheId, call)));

            const effect = b.call(
                "$.template_effect",
                b.thunk(
                    statements.length === 1
                        ? statements[0].expression
                        : b.block(statements),
                ),
            );

            context.state.update.push(b.stmt(effect));
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
                    },
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
                        expression,
                    );

                    statements.push(b.stmt(call));
                } else {
                    const expression = serializeAttributeValue(
                        attr.value,
                        true,
                        context,
                    );

                    checkIsDynamic(expression);

                    let method = "$.set_class";

                    if (SVGElements.includes(node.name)) {
                        method = "$.set_svg_class";
                    }

                    const call = b.call(method, context.state.node, expression);

                    statements.push(b.stmt(call));
                }
            }

            if (isDynamic) {
                const call = b.call(
                    "$.template_effect",
                    b.thunk(
                        statements.length === 1
                            ? statements[0].expression
                            : b.block(statements),
                    ),
                );
                context.state.update.push(call);
            } else {
                context.state.update.push(...statements);
            }
        }

        context.state.template.push(">");

        const { hoisted, trimmed } = cleanNodes(
            node,
            node.fragment.nodes,
            context.path,
            "html",
            context.state.options.preserveWhitespace,
            context.state.options.preserveComments,
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
                        : context.state.node,
                ),
            true,
            context,
        );

        if (!VoidElements.includes(node.name)) {
            context.state.template.push(`</${node.name}>`);
        }
    },

    SnippetBlock(node, { visit, state, path }) {
        const args = [b.id("$$anchor")];
        const params = [];

        for (const param of node.parameters) {
            params.push(param.name);
            args.push(b.id(param.name));
        }

        const privateScope = state.nonPropVars.includes(node.expression.name);
        const id = /** @type {import("estree").Pattern} */ (
            visit(node.expression, state)
        );

        const value = b.arrow(
            args,
            // @ts-expect-error
            /** @type {import("estree").BlockStatement} */ (
                visit(node.body, {
                    ...state,
                    nonPropGetters: [...state.nonPropGetters, ...params],
                })
            ),
        );

        state.init.push(
            privateScope ? b.var(id, value) : b.assignment("=", id, value),
        );
    },

    RenderTag(node, { visit, state }) {
        const callee = /** @type {import("estree").Expression} */ (
            visit(
                node.expression.type === "CallExpression"
                    ? node.expression.callee
                    : node.expression.name,
            )
        );

        const call = b.call("$.snippet", b.thunk(callee), state.node);

        for (const arg of node.expression.arguments) {
            call.arguments.push(
                b.thunk(
                    /** @type {import("estree").Expression} */ (visit(arg)),
                ),
            );
        }

        state.template.push("<!>");
        state.init.push(b.stmt(call));
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
                args.push(
                    /** @type {import("estree").Expression} */ (
                        context.visit(arg)
                    ),
                );
            }

            const call = b.call(
                "$.filter",
                context.state.options.hasJS ? b.id("$$prop") : b.id("$$props"),
                b.literal(node.name.name),
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
                        ? state.els
                            ? b.id("$$els")
                            : b.call("$$prop", b.literal(member.object.name))
                        : b.id("$$props"),
                    member,
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
                        ? state.els
                            ? b.id("$$els")
                            : b.call("$$prop", b.literal(id.name))
                        : b.id("$$props"),
                    id,
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
        let expression = b.call(
            "$.in",
            /** @type {import("estree").Expression} */ (visit(node.left)),
            /** @type {import("estree").Expression} */ (visit(node.right)),
        );

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
                    const test = b.call(
                        "$.is_empty",
                        /** @type {import("estree").Expression} */ (
                            visit(node.left)
                        ),
                    );
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
                            }`,
                        );
                    }

                    if (state.options.hasJS) {
                        return b.binary(
                            b.call("$$prop", b.literal(node.left.name)),
                            node.not ? "===" : "!==",
                            b.id("undefined"),
                        );
                    }

                    const test = b.binary(
                        b.literal(node.left.name),
                        "in",
                        b.id("$$props"),
                    );
                    if (node.not) return b.unary("!", test);
                    return test;
                }
            }
        } else if (node.right.type === "NullLiteral") {
            return b.binary(
                /** @type {import("estree").Expression} */ (visit(node.left)),
                node.not ? "!==" : "===",
                b.literal(null),
            );
        }

        throw new Error(
            `Unhandled kind of "IsExpression" at ${node.right.start}`,
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
            ),
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
            ),
        );
    },

    // @ts-expect-error
    RangeExpression(node, context) {
        const array = b.array();

        const count = Math.abs(node.to.value - node.from.value);

        for (let i = 0; i <= count; i++) {
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

    HtmlTag(node, { state, visit }) {
        state.template.push("<!>");

        state.init.push(
            b.call(
                "$.html",
                state.node,
                b.thunk(
                    /** @type {import("estree").Expression} */ (
                        visit(node.expression)
                    ),
                ),
                b.false,
                b.false,
            ),
        );
    },

    IfBlock(node, { state, visit }) {
        state.template.push("<!>");

        const call = b.call(
            "$.if",
            state.node,
            b.thunk(
                /** @type {import("estree").Expression} */ (visit(node.test)),
            ),
            b.arrow(
                [b.id("$$anchor")],
                /** @type {import("estree").Expression} */ (
                    visit(node.consequent)
                ),
            ),
            node.alternate
                ? b.arrow(
                      [b.id("$$anchor")],
                      /** @type {import("estree").Expression} */ (
                          visit(node.alternate)
                      ),
                  )
                : b.literal(null),
        );

        if (node.elseif) {
            call.arguments.push(b.true);
        }

        state.init.push(b.stmt(call));
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
                b.call("$.unwrap", b.id("$$key")),
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

        const array = b.call(
            "$.iterable",
            /** @type {import("estree").Expression} */ (visit(node.expression)),
        );
        const unwrapIndex = b.call("$.unwrap", b.id("$$index"));
        const loopInit = [];

        if (isInForBlock) {
            state.init.push(b.var(b.id("parentLoop"), b.id("loop")));
        }

        loopInit.push(
            b.var(
                b.id("loop"),
                b.call(
                    "$.loop",
                    b.thunk(unwrapIndex),
                    b.thunk(array),
                    isInForBlock ? b.id("parentLoop") : b.literal(null),
                ),
            ),
        );

        if (node.index) {
            const expression = b.member(
                b.call(
                    "Object.keys",
                    /** @type {import("estree").Expression} */ (
                        visit(node.expression)
                    ),
                ),
                unwrapIndex,
                true,
            );

            loopInit.push(
                b.var(
                    node.index.name,
                    b.call("$.derived", b.thunk(expression)),
                ),
            );
        }

        body.body.unshift(...loopInit);

        call.arguments.push(
            b.literal(flags),
            b.thunk(array),
            key,
            b.arrow(
                [b.id("$$anchor"), b.id(node.context.name), b.id("$$index")],
                body,
            ),
        );

        state.init.push(call);
    },

    KeyBlock(node, { visit, state }) {
        const call = b.call(
            "$.key",
            state.node,
            b.thunk(
                /** @type {import("estree").Expression} */ (
                    visit(node.expression)
                ),
            ),
            b.arrow(
                [b.id("$$anchor")],
                /** @type {import("estree").Expression} */ (
                    visit(node.fragment)
                ),
            ),
        );

        state.template.push("<!>");
        state.init.push(call);
    },

    Component(node, context) {
        context.state.template.push("<!>");

        let alreadyImported;

        for (const hoist of context.state.hoisted) {
            if (
                hoist.type === "ImportDeclaration" &&
                hoist.source.value === node.key.data &&
                hoist.specifiers[0].type === "ImportDefaultSpecifier"
            ) {
                alreadyImported = hoist.specifiers[0].local;
            }
        }

        const nodeId = context.state.node;
        const id =
            alreadyImported ??
            context.state.scope.root.unique(
                (/([^/]+)$/.exec(node.key.data)?.[1] ?? "component").replace(
                    /\.\w+$/,
                    "",
                ) + "Component",
            );

        if (!alreadyImported) {
            context.state.hoisted.unshift(
                b.import(node.key.data, {
                    type: "ImportDefaultSpecifier",
                    local: id,
                }),
            );
        }

        const statement = serializeComponentProps(
            node,
            context,
            (props, bindThis) => bindThis(b.call(id, nodeId, props)),
        );

        context.state.init.push(statement);
    },

    ZvelteComponent(node, context) {
        context.state.template.push("<!>");

        const nodeId = context.state.node;
        const statement = serializeComponentProps(
            node,
            context,
            (props, bindThis) =>
                b.call(
                    "$.component",
                    b.thunk(
                        /** @type {import('estree').Expression} */ (
                            context.visit(node.expression)
                        ),
                    ),
                    b.arrow(
                        [b.id("$$component")],
                        b.block([
                            b.stmt(
                                bindThis(b.call("$$component", nodeId, props)),
                            ),
                        ]),
                    ),
                ),
        );

        context.state.init.push(statement);
    },
};

/**
 * @param {import("#ast").ZvelteComponent | import("#ast").Component} node
 * @param {import("./types.js").ComponentContext} context
 * @param {(statement: import("estree").ObjectExpression | import("estree").CallExpression, bindThis: (expression: import("estree").Expression) => import("estree").Expression) => import("estree").Expression} wrap
 */
function serializeComponentProps(node, context, wrap) {
    const parent = context.path[context.path.length - 1];
    const { props, pushProp, bindThis } = serializeAttibutesForComponent(
        node.attributes,
        context,
    );

    const { hoisted, trimmed } = cleanNodes(
        parent,
        node.fragment.nodes,
        context.path,
        undefined,
        context.state.options.preserveWhitespace,
        context.state.options.preserveComments,
    );

    /** @type {any[]} */
    const privateScope = [];

    for (const child of hoisted) {
        if (child.type === "SnippetBlock") {
            pushProp(
                b.prop(
                    "init",
                    b.id(child.expression.name),
                    b.id(child.expression.name),
                ),
            );
            context.visit(child, {
                ...context.state,
                init: privateScope,
                nonPropVars: [
                    ...context.state.nonPropVars,
                    child.expression.name,
                ],
            });
        } else {
            context.visit(child);
        }
    }

    if (trimmed.length) {
        const block = createBlock(parent, "root", trimmed, context);
        pushProp(
            b.prop(
                "init",
                b.id("children"),
                b.arrow([b.id("$$anchor")], b.block(block)),
            ),
        );
    }

    const expression = wrap(props, (expression) =>
        bindThis
            ? b.call("$.bind_this", expression, bindThis.set, bindThis.get)
            : expression,
    );

    if (privateScope.length) {
        return b.block([...privateScope, b.stmt(expression)]);
    }

    return b.stmt(expression);
}

/**
 * @param {Array<import("#ast").ZvelteComponent["attributes"][number] | import("#ast").Component["attributes"][number]>} attributes
 * @param {Pick<import('./types.js').ComponentContext, "visit" | "state">} context
 */
function serializeAttibutesForComponent(attributes, { visit, state }) {
    /** @type {import("estree").Expression[]} */
    const args = [];

    const props = () => {
        const last = args.at(-1);
        if (last?.type === "ObjectExpression") return last.properties;

        const o = b.object([]);
        args.push(o);
        return o.properties;
    };

    /**
     * @type {{
     *  get: import('estree').Expression
     *  set: import('estree').ArrowFunctionExpression
     * }=}
     */
    let bindThis;

    /**
     * @param {import("estree").Node} expression
     */
    function checkIsDynamic(expression) {
        let isDynamic = false;
        walk(
            expression,
            {},
            {
                Identifier(_, { stop, path, next }) {
                    const parent = path[path.length - 1];
                    if (parent.type === "Property" && !parent.computed) {
                        next();
                    } else {
                        isDynamic = true;
                        stop();
                    }
                },
            },
        );

        return isDynamic;
    }

    for (const attr of attributes) {
        /**
         * @param {string} key
         * @param {import("estree").Expression} expression
         */
        const get = (key, expression) =>
            props().push(
                b.prop(
                    "get",
                    b.id(key),
                    checkIsDynamic(expression)
                        ? b.function(null, [], b.block([b.return(expression)]))
                        : expression,
                ),
            );

        /**
         * @param {string} key
         * @param {import("estree").Pattern} expression
         */
        const set = (key, expression) =>
            props().push(
                b.prop(
                    "set",
                    b.id(key),
                    b.function(
                        null,
                        [b.id("$$value")],
                        b.block([
                            b.stmt(
                                b.assignment("=", expression, b.id("$$value")),
                            ),
                        ]),
                    ),
                ),
            );

        switch (attr.type) {
            case "Attribute": {
                get(
                    attr.name,
                    serializeAttributeValue(attr.value, false, {
                        visit,
                        state,
                    }),
                );
                break;
            }

            case "BindDirective": {
                const pattern =
                    /** @type {import('estree').Identifier | import('estree').MemberExpression} */ (
                        visit(attr.expression, {
                            ...state,
                            els: attr.name === "this",
                        })
                    );

                if (attr.name === "this") {
                    bindThis = {
                        get: b.thunk(pattern),
                        set: b.arrow(
                            [b.id("$$value")],
                            b.assignment("=", pattern, b.id("$$value")),
                        ),
                    };
                } else {
                    get(attr.name, pattern);
                    set(attr.name, pattern);
                }

                break;
            }

            case "SpreadAttribute": {
                const value = /** @type {import("estree").Expression} */ (
                    visit(attr.expression)
                );

                args.push(checkIsDynamic(value) ? b.thunk(value) : value);
                break;
            }

            default:
                throw new Error(
                    `Component attributes: "${attr.type}" is not handled yet`,
                );
        }
    }

    if (!args.length) {
        args.push(b.object([]));
    }

    const out = {
        props:
            args.length === 1 && args[0].type === "ObjectExpression"
                ? args[0]
                : b.call("$.spread_props", ...args),
        bindThis,
        /**
         * @param {import("estree").ObjectExpression["properties"]} props
         */
        pushProp(...props) {
            if (out.props.type === "ObjectExpression") {
                out.props.properties.push(...props);
            } else {
                const last =
                    out.props.arguments[out.props.arguments.length - 1];
                if (last.type === "ObjectExpression") {
                    last.properties.push(...props);
                } else {
                    out.props.arguments.push(b.object(props));
                }
            }
        },
    };

    return out;
}

/**
 * @param {import('estree').Expression} expression
 * @param {import('./types.js').ComponentClientTransformState} state
 * @param {string} name
 */
function getNodeId(expression, state, name) {
    let id = expression;

    if (id.type !== "Identifier") {
        id = b.id(state.scope.generate(name));

        state.init.push(b.var(id, expression));
    }
    return id;
}

/**
 * @param {import("#ast").Attribute["value"]} attributeValue
 * @param {boolean} isElement
 * @param {Pick<import('./types.js').ComponentContext, "visit" | "state">} context
 * @returns {import("estree").Expression}
 */
function serializeAttributeValue(attributeValue, isElement, { visit, state }) {
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

            if (attributeValue.length !== 1 && isElement) {
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
            node.type === "FilterExpression" ? node.name : node.callee,
        )
    );

    const args = node.arguments.map(
        (arg) =>
            /** @type {import("estree").Expression} */ (context.visit(arg)),
    );

    return b.call(name, ...args);
}

/**
 *
 * @param {string} namespace
 * @param {import('./types.js').ComponentClientTransformState} state
 * @returns
 */
function getTemplateFunction(namespace, state) {
    const contains_script_tag =
        state.metadata.context.template_contains_script_tag;
    return namespace === "svg"
        ? contains_script_tag
            ? "$.svg_template_with_script"
            : "$.ns_template"
        : namespace === "mathml"
          ? "$.mathml_template"
          : contains_script_tag
            ? "$.template_with_script"
            : "$.template";
}

/**
 *
 * @param {import('./types.js').ComponentClientTransformState} state
 */
function serializeRenderStmt(state) {
    return state.update.length === 1
        ? serializeUpdate(state.update[0])
        : b.stmt(b.call("$.template_effect", b.thunk(b.block(state.update))));
}

/**
 *
 * @param {import('estree').Statement} statement
 */
function serializeUpdate(statement) {
    const body =
        statement.type === "ExpressionStatement"
            ? statement.expression
            : b.block([statement]);

    return b.stmt(b.call("$.template_effect", b.thunk(body)));
}
