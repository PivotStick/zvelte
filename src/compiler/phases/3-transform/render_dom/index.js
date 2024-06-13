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
import {
    isEventAttribute,
    isTextAttribute,
    object,
} from "../../../shared/utils/ast.js";
import { escapeHtml } from "../../../escaping.js";
import { regex_is_valid_identifier } from "../../patterns.js";
import { filters } from "../../../../internal/client/runtime/filters.js";
import { hash } from "../../../utils/hash.js";

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
        context.state.preserve_whitespace ?? false,
        context.state.options.preserveComments ?? true
    );

    if (hoisted.length === 0 && trimmed.length === 0) {
        return [];
    }

    const is_single_element =
        trimmed.length === 1 && trimmed[0].type === "RegularElement";
    const is_single_child_not_needing_template = false;
    // @todo implement when these will exist
    //
    // trimmed.length === 1 &&
    // (trimmed[0].type === "ZvelteFragment" ||
    //     trimmed[0].type === "TitleElement");

    const template_name = context.state.scope.root.unique(name);

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

    for (const node of hoisted) {
        context.visit(node, state);
    }

    /**
     * @param {import('estree').Identifier} template_name
     * @param {import('estree').Expression[]} args
     */
    const add_template = (template_name, args) => {
        let call = b.call(get_template_function(namespace, state), ...args);
        context.state.hoisted.push(b.var(template_name, call));
    };

    if (is_single_element) {
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

        add_template(template_name, args);

        body.push(
            b.var(id, b.call(template_name)),
            ...state.before_init,
            ...state.init
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
                (node) => node.type === "Text" || node.type === "ExpressionTag"
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
                ...state.init
            );
            close = b.stmt(b.call("$.append", b.id("$$anchor"), id));
        } else {
            /** @type {(is_text: boolean) => import('estree').Expression} */
            const expression = (is_text) =>
                is_text
                    ? b.call("$.first_child", id, b.true)
                    : b.call("$.first_child", id);

            processChildren(trimmed, expression, false, { ...context, state });

            let flags = TEMPLATE_FRAGMENT;

            if (state.metadata.context.template_needs_import_node) {
                flags |= TEMPLATE_USE_IMPORT_NODE;
            }

            add_template(template_name, [
                b.template([b.quasi(state.template.join(""), true)], []),
                b.literal(flags),
            ]);

            body.push(b.var(id, b.call(template_name)));
            body.push(...state.before_init, ...state.init);

            close = b.stmt(b.call("$.append", b.id("$$anchor"), id));
        }
    } else {
        body.push(...state.before_init, ...state.init);
    }

    if (state.update.length > 0) {
        body.push(serialize_render_stmt(state));
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
 * @param {import('#ast').ZvelteNode[]} nodes
 * @param {(is_text: boolean) => import('estree').Expression} expression
 * @param {boolean} is_element
 * @param {import('./types.js').ComponentContext} context
 */
function processChildren(nodes, expression, is_element, { visit, state }) {
    const within_bound_contenteditable = state.metadata.bound_contenteditable;

    /** @typedef {Array<import('#ast').Text | import('#ast').ExpressionTag | import("#ast").VariableTag>} Sequence */

    /** @type {Sequence} */
    let sequence = [];

    /**
     * @param {Sequence} sequence
     */
    function flush_sequence(sequence) {
        if (sequence.length === 1) {
            const node = sequence[0];

            if (node.type === "Text") {
                let prev = expression;
                expression = () => b.call("$.sibling", prev(true));
                state.template.push(node.data);
                return;
            }

            if (node.type === "Variable") {
                state.update.push(
                    b.stmt(
                        b.assignment(
                            "=",
                            /** @type {import('estree').Expression} */ (
                                // @ts-expect-error
                                visit(node.name)
                            ),
                            /** @type {import('estree').Expression} */ (
                                visit(node.value)
                            )
                        )
                    )
                );
                return;
            }

            state.template.push(" ");

            const text_id = getNodeId(expression(true), state, "text");

            const value = b.logical(
                /** @type {import('estree').Expression} */ (
                    visit(node.expression)
                ),
                "??",
                b.literal("")
            );
            const update = b.stmt(b.call("$.set_text", text_id, value));

            if (node.expression && !within_bound_contenteditable) {
                state.init.push(serialize_update(update));
            } else if (node.metadata.dynamic && !within_bound_contenteditable) {
                state.update.push(update);
            } else {
                state.init.push(
                    b.stmt(
                        b.assignment(
                            "=",
                            b.member(text_id, b.id("nodeValue")),
                            value
                        )
                    )
                );
            }

            expression = (is_text) =>
                is_text
                    ? b.call("$.sibling", text_id, b.true)
                    : b.call("$.sibling", text_id);
        } else {
            const text_id = getNodeId(expression(true), state, "text");

            state.template.push(" ");

            const [contains_call_expression, value, assignments] =
                serializeTemplateLiteral(sequence, visit, state);

            const update = b.stmt(b.call("$.set_text", text_id, value));

            if (contains_call_expression && !within_bound_contenteditable) {
                state.init.push(...assignments.map((a) => b.stmt(a)));
                state.init.push(serialize_update(update));
            } else if (
                sequence.some(
                    (node) =>
                        node.type === "ExpressionTag" && node.metadata.dynamic
                ) &&
                !within_bound_contenteditable
            ) {
                state.update.push(...assignments.map((a) => b.stmt(a)));
                state.update.push(update);
            } else {
                state.init.push(...assignments.map((a) => b.stmt(a)));
                state.init.push(
                    b.stmt(
                        b.assignment(
                            "=",
                            b.member(text_id, b.id("nodeValue")),
                            value
                        )
                    )
                );
            }

            expression = (is_text) =>
                is_text
                    ? b.call("$.sibling", text_id, b.true)
                    : b.call("$.sibling", text_id);
        }
    }

    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];

        if (
            node.type === "Text" ||
            node.type === "ExpressionTag" ||
            node.type === "Variable"
        ) {
            sequence.push(node);
        } else {
            if (sequence.length > 0) {
                flush_sequence(sequence);
                sequence = [];
            }

            if (node.type === "SnippetBlock") {
                // These nodes do not contribute to the sibling/child tree
                // TODO what about e.g. ConstTag and all the other things that
                // get hoisted inside clean_nodes?
                visit(node, state);
            } else {
                if (
                    node.type === "ForBlock" &&
                    nodes.length === 1 &&
                    is_element
                ) {
                    node.metadata.is_controlled = true;
                    visit(node, state);
                } else {
                    const id = getNodeId(
                        expression(false),
                        state,
                        node.type === "RegularElement" ? node.name : "node"
                    );

                    expression = (is_text) =>
                        is_text
                            ? b.call("$.sibling", id, b.true)
                            : b.call("$.sibling", id);

                    visit(node, {
                        ...state,
                        node: id,
                    });
                }
            }
        }
    }

    if (sequence.length > 0) {
        flush_sequence(sequence);
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

        /** @type {import('#ast').Attribute[]} */
        const attributes = [];
        /** @type {import('#ast').ClassDirective[]} */
        const class_directives = [];

        let needs_input_reset = false;
        let needs_content_reset = false;

        /** @type {import('#ast').BindDirective | null} */
        let value_binding = null;

        /** If true, needs `__value` for inputs */
        let needs_special_value_handling =
            node.name === "option" || node.name === "select";
        let is_content_editable = false;
        let has_content_editable_binding = false;
        let img_might_be_lazy = false;

        for (const attribute of node.attributes) {
            if (attribute.type === "Attribute") {
                attributes.push(attribute);
                if (node.name === "img" && attribute.name === "loading") {
                    img_might_be_lazy = true;
                }
                if (
                    (attribute.name === "value" ||
                        attribute.name === "checked") &&
                    !isTextAttribute(attribute)
                ) {
                    needs_input_reset = true;
                    needs_content_reset = true;
                } else if (
                    attribute.name === "contenteditable" &&
                    (attribute.value === true ||
                        (isTextAttribute(attribute) &&
                            attribute.value[0].data === "true"))
                ) {
                    is_content_editable = true;
                }
            } else if (attribute.type === "ClassDirective") {
                class_directives.push(attribute);
            } else {
                if (attribute.type === "BindDirective") {
                    if (
                        attribute.name === "group" ||
                        attribute.name === "checked"
                    ) {
                        needs_special_value_handling = true;
                        needs_input_reset = true;
                    } else if (attribute.name === "value") {
                        value_binding = attribute;
                        needs_content_reset = true;
                        needs_input_reset = true;
                    } else if (
                        attribute.name === "innerHTML" ||
                        attribute.name === "innerText" ||
                        attribute.name === "textContent"
                    ) {
                        has_content_editable_binding = true;
                    }
                }
                context.visit(attribute);
            }
        }

        if (
            needs_input_reset &&
            (node.name === "input" || node.name === "select")
        ) {
            context.state.init.push(
                b.stmt(
                    b.call("$.remove_input_attr_defaults", context.state.node)
                )
            );
        }

        if (needs_content_reset && node.name === "textarea") {
            context.state.init.push(
                b.stmt(b.call("$.remove_textarea_child", context.state.node))
            );
        }

        if (value_binding !== null && node.name === "select") {
            setup_select_synchronization(value_binding, context);
        }

        const node_id = context.state.node;

        // Then do attributes
        let is_attributes_reactive = false;
        if (node.metadata?.has_spread) {
            if (node.name === "img") {
                img_might_be_lazy = true;
            }
            serialize_element_spread_attributes(
                attributes,
                context,
                node,
                node_id,
                // If value binding exists, that one takes care of calling $.init_select
                value_binding === null &&
                    node.name === "select" &&
                    child_metadata.namespace !== "foreign"
            );
            is_attributes_reactive = true;
        } else {
            for (const attribute of /** @type {import('#ast').Attribute[]} */ (
                attributes
            )) {
                if (isEventAttribute(attribute)) {
                    serializeEventAttribute(attribute, context);
                    continue;
                }

                if (
                    needs_special_value_handling &&
                    attribute.name === "value"
                ) {
                    serialize_element_special_value_attribute(
                        node.name,
                        node_id,
                        attribute,
                        context
                    );
                    continue;
                }

                if (
                    attribute.name !== "autofocus" &&
                    (attribute.value === true || isTextAttribute(attribute))
                ) {
                    const name = getAttributeName(node, attribute, context);
                    const literal_value =
                        /** @type {import('estree').Literal} */ (
                            serializeAttributeValue(attribute.value, context)[1]
                        ).value;
                    if (name !== "class" || literal_value) {
                        // TODO namespace=foreign probably doesn't want to do template stuff at all and instead use programmatic methods
                        // to create the elements it needs.
                        context.state.template.push(
                            ` ${attribute.name}${
                                DOMBooleanAttributes.includes(name) &&
                                literal_value === true
                                    ? ""
                                    : `="${
                                          literal_value === true
                                              ? ""
                                              : escapeHtml(literal_value, true)
                                      }"`
                            }`
                        );
                        continue;
                    }
                }

                const is = serialize_element_attribute_update_assignment(
                    node,
                    node_id,
                    attribute,
                    context
                );
                if (is) is_attributes_reactive = true;
            }
        }

        // class/style directives must be applied last since they could override class/style attributes
        serializeClassDirectives(
            class_directives,
            node_id,
            context,
            is_attributes_reactive
        );

        context.state.template.push(`>`);

        /** @type {import('./types.js').ComponentClientTransformState} */
        const state = {
            ...context.state,
            scope: /** @type {Scope} */ (
                context.state.scopes.get(node.fragment)
            ),
            preserve_whitespace:
                context.state.preserve_whitespace ||
                node.name === "pre" ||
                node.name === "textarea",
        };

        const { hoisted, trimmed } = cleanNodes(
            node,
            node.fragment.nodes,
            context.path,
            "html",
            node.name === "script" || (state.preserve_whitespace ?? false),
            state.options.preserveComments ?? false
        );

        for (const node of hoisted) {
            context.visit(node, state);
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
            true,
            { ...context, state }
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
                visit(node.expression),
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
        const callee = visit(
            node.expression.type === "CallExpression"
                ? node.expression.callee
                : node.expression.name
        );

        const call = b.call("$.snippet", b.thunk(callee), state.node);

        for (const arg of node.expression.arguments) {
            call.arguments.push(b.thunk(visit(arg)));
        }

        state.template.push("<!>");
        state.init.push(b.stmt(call));
    },

    Attribute(node, context) {
        if (isEventAttribute(node)) {
            serializeEventAttribute(node, context);
        } else {
            console.log(node);
        }
    },

    OnDirective(node, context) {
        serializeEvent(node, context);
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

            return b.call("$.filter", b.literal(node.name.name), ...args);
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
            path.at(-1)?.type !== "MemberExpression" &&
            member.object.type === "Identifier"
        ) {
            if (state.nonPropSources.includes(member.object.name)) {
                member = b.member(b.call("$.unwrap", member.object), property);
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

        if (parent.type !== "MemberExpression" || parent.computed) {
            if (state.nonPropSources.includes(id.name)) {
                id = b.call("$.unwrap", id);
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
        state.template.push(`<${node.name}> </${node.name}>`);

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
                console.log(hoist.source.value, node.key.data);
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
        const anchor = b.id(state.scope.generate(id.name + "_anchor"));

        if (!alreadyImported) {
            state.hoisted.unshift(
                b.import(node.key.data, {
                    type: "ImportDefaultSpecifier",
                    local: id,
                })
            );
        }

        state.init.push(
            b.var(anchor, b.call("$.first_child", state.node, b.literal(1)))
        );
        state.init.push(
            b.stmt(
                b.assignment("=", b.member(anchor, b.id("data")), b.literal(""))
            )
        );
        state.init.push(b.call(id, anchor, b.object(properties)));
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

        // @ts-ignore
        const body = /** @type {import('estree').BlockStatement} */ (
            visit(node.body, {
                ...state,
                nonPropVars: [...state.nonPropVars, "loop"],
                nonPropSources: [...state.nonPropSources, node.context.name],
            })
        );

        const isInForBlock = path.some((node) => node.type === "ForBlock");

        const unwrapIndex = b.call("$.unwrap", b.id("$$index"));
        const length = b.member(visit(node.expression), b.id("length"));

        const loop = {
            index: b.binary(unwrapIndex, "+", b.literal(1)),
            index0: unwrapIndex,
            revindex: b.binary(length, "-", unwrapIndex),
            revindex0: b.binary(
                b.binary(length, "-", unwrapIndex),
                "-",
                b.literal(1)
            ),
            first: b.binary(unwrapIndex, "===", b.literal(0)),
            last: b.binary(
                unwrapIndex,
                "===",
                b.binary(length, "-", b.literal(1))
            ),
            length,
            parent: isInForBlock ? b.id("parentLoop") : b.literal(null),
        };

        body.body.unshift(
            b.const(
                b.id("loop"),
                b.object(
                    Object.entries(loop).map(([key, expression]) =>
                        b.prop(
                            "get",
                            b.id(key),
                            b.function(
                                null,
                                [],
                                b.block([b.return(expression)])
                            )
                        )
                    )
                )
            )
        );

        if (isInForBlock) {
            body.body.unshift(b.const(b.id("parentLoop"), b.id("loop")));
        }

        call.arguments.push(
            b.literal(flags),
            b.thunk(visit(node.expression)),
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
 *
 * @param {string} namespace
 * @param {import('./types.js').ComponentClientTransformState} state
 * @returns
 */
function get_template_function(namespace, state) {
    const containsScriptTag =
        state.metadata.context.template_contains_script_tag;

    return namespace === "svg"
        ? containsScriptTag
            ? "$.svg_template_with_script"
            : "$.svg_template"
        : namespace === "mathml"
        ? "$.mathml_template"
        : containsScriptTag
        ? "$.template_with_script"
        : "$.template";
}

/**
 *
 * @param {import('./types.js').ComponentClientTransformState} state
 */
function serialize_render_stmt(state) {
    return state.update.length === 1
        ? serialize_update(state.update[0])
        : b.stmt(b.call("$.template_effect", b.thunk(b.block(state.update))));
}

/**
 *
 * @param {import('estree').Statement} statement
 */
function serialize_update(statement) {
    const body =
        statement.type === "ExpressionStatement"
            ? statement.expression
            : b.block([statement]);

    return b.stmt(b.call("$.template_effect", b.thunk(body)));
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
 * @param {import('#ast').Attribute & { value: [import('#ast').ExpressionTag] }} node
 * @param {import('./types.js').ComponentContext} context
 */
function serializeEventAttribute(node, context) {
    /** @type {string[]} */
    const modifiers = [];

    let event_name = node.name.slice(2);
    if (
        event_name.endsWith("capture") &&
        event_name !== "ongotpointercapture" &&
        event_name !== "onlostpointercapture"
    ) {
        event_name = event_name.slice(0, -7);
        modifiers.push("capture");
    }

    serializeEvent(
        {
            name: event_name,
            expression: node.value[0].expression,
            modifiers,
            delegated: node.metadata.delegated,
        },
        context
    );
}

/**
 * Serializes an event handler function of the `on:` directive or an attribute starting with `on`
 * @param {{name: string; modifiers: string[]; expression: import('estree').Expression | null; delegated?: import('#compiler').DelegatedEvent | null; }} node
 * @param {import('./types.js').ComponentContext} context
 */
function serializeEvent(node, context) {
    const state = context.state;

    /** @type {import('estree').Statement} */
    let statement;

    if (node.expression) {
        let handler = serializeEventHandler(node, context);
        const event_name = node.name;
        const delegated = node.delegated;

        if (delegated != null) {
            let delegated_assignment;

            if (!state.events.has(event_name)) {
                state.events.add(event_name);
            }
            // Hoist function if we can, otherwise we leave the function as is
            if (delegated.type === "hoistable") {
                if (delegated.function === node.expression) {
                    const func_name = context.state.scope.root.unique(
                        "on_" + event_name
                    );
                    state.hoisted.push(b.var(func_name, handler));
                    handler = func_name;
                }
                if (node.modifiers.includes("once")) {
                    handler = b.call("$.once", handler);
                }
                const hoistable_params =
                    /** @type {import('estree').Expression[]} */ (
                        delegated.function.metadata.hoistable_params
                    );
                // When we hoist a function we assign an array with the function and all
                // hoisted closure params.
                const args = [handler, ...hoistable_params];
                delegated_assignment = b.array(args);
            } else {
                if (node.modifiers.includes("once")) {
                    handler = b.call("$.once", handler);
                }
                delegated_assignment = handler;
            }

            state.init.push(
                b.stmt(
                    b.assignment(
                        "=",
                        b.member(context.state.node, b.id("__" + event_name)),
                        delegated_assignment
                    )
                )
            );
            return;
        }

        if (node.modifiers.includes("once")) {
            handler = b.call("$.once", handler);
        }

        const args = [
            b.literal(event_name),
            context.state.node,
            handler,
            b.literal(node.modifiers.includes("capture")),
        ];

        if (node.modifiers.includes("passive")) {
            args.push(b.true);
        } else if (node.modifiers.includes("nonpassive")) {
            args.push(b.false);
        } else if (PassiveEvents.includes(node.name)) {
            args.push(b.true);
        }

        // Events need to run in order with bindings/actions
        statement = b.stmt(b.call("$.event", ...args));
    } else {
        statement = b.stmt(
            b.call(
                "$.event",
                b.literal(node.name),
                state.node,
                serializeEventHandler(node, context)
            )
        );
    }

    const parent = /** @type {import('#ast').ZvelteNode} */ (
        context.path.at(-1)
    );
    if (parent.type === "ZvelteDocument" || parent.type === "ZvelteWindow") {
        state.before_init.push(statement);
    } else {
        state.after_update.push(statement);
    }
}

/**
 * Serializes the event handler function of the `on:` directive
 * @param {Pick<import('#ast').OnDirective, 'name' | 'modifiers' | 'expression'>} node
 * @param {import('./types.js').ComponentContext} context
 */
function serializeEventHandler(node, { state, visit }) {
    /** @type {import('estree').Expression} */
    let handler;

    if (node.expression) {
        const expr = node.expression;

        // Event handlers can be dynamic (source/store/prop/conditional etc)
        const dynamic_handler = () =>
            b.function(
                null,
                [b.rest(b.id("$$args"))],
                b.block([
                    b.const(
                        "$$callback",
                        /** @type {import('estree').Expression} */ (visit(expr))
                    ),
                    b.return(
                        b.call(
                            b.member(
                                b.id("$$callback"),
                                b.id("apply"),
                                false,
                                true
                            ),
                            b.this,
                            b.id("$$args")
                        )
                    ),
                ])
            );

        if (expr.type === "Identifier" || expr.type === "MemberExpression") {
            const id = object(expr);

            /** @type {any} */
            const binding = id === null ? null : state.scope.get(id.name);

            if (
                binding !== null &&
                (binding.kind === "state" ||
                    binding.kind === "frozen_state" ||
                    binding.declaration_kind === "import" ||
                    binding.kind === "legacy_reactive" ||
                    binding.kind === "derived" ||
                    binding.kind === "prop" ||
                    binding.kind === "bindable_prop" ||
                    binding.kind === "store_sub")
            ) {
                handler = dynamic_handler();
            } else {
                handler = /** @type {import('estree').Expression} */ (
                    visit(expr)
                );
            }
        } else if (
            expr.type === "ConditionalExpression" ||
            expr.type === "LogicalExpression"
        ) {
            handler = dynamic_handler();
        } else {
            handler = /** @type {import('estree').Expression} */ (visit(expr));
        }
    } else {
        state.analysis.needs_props = true;

        // Function + .call to preserve "this" context as much as possible
        handler = b.function(
            null,
            [b.id("$$arg")],
            b.block([
                b.stmt(
                    b.call(
                        "$.bubble_event.call",
                        b.this,
                        b.id("$$props"),
                        b.id("$$arg")
                    )
                ),
            ])
        );
    }

    if (node.modifiers.includes("stopPropagation")) {
        handler = b.call("$.stopPropagation", handler);
    }
    if (node.modifiers.includes("stopImmediatePropagation")) {
        handler = b.call("$.stopImmediatePropagation", handler);
    }
    if (node.modifiers.includes("preventDefault")) {
        handler = b.call("$.preventDefault", handler);
    }
    if (node.modifiers.includes("self")) {
        handler = b.call("$.self", handler);
    }
    if (node.modifiers.includes("trusted")) {
        handler = b.call("$.trusted", handler);
    }

    return handler;
}

/**
 * @param {true | Array<import('#ast').Text | import('#ast').ExpressionTag>} attribute_value
 * @param {import('./types.js').ComponentContext} context
 * @returns {[boolean, import('estree').Expression]}
 */
function serializeAttributeValue(attribute_value, context) {
    let contains_call_expression = false;

    if (attribute_value === true) {
        return [contains_call_expression, b.true];
    }

    if (attribute_value.length === 0) {
        return [contains_call_expression, b.literal("")]; // is this even possible?
    }

    if (attribute_value.length === 1) {
        const value = attribute_value[0];
        if (value.type === "Text") {
            return [contains_call_expression, b.literal(value.data)];
        } else {
            if (value.type === "ExpressionTag") {
                contains_call_expression =
                    value.metadata?.contains_call_expression;
            }
            return [
                contains_call_expression,
                /** @type {import('estree').Expression} */ (
                    context.visit(value.expression)
                ),
            ];
        }
    }

    return serializeTemplateLiteral(
        attribute_value,
        context.visit,
        context.state
    );
}

/**
 * @param {import('#ast').RegularElement} element
 * @param {import('#ast').Attribute} attribute
 * @param {{ state: { metadata: { namespace: import('#ast').Namespace }}}} context
 */
function getAttributeName(element, attribute, context) {
    let name = attribute.name;
    if (
        !element.metadata?.svg &&
        !element.metadata?.mathml &&
        context.state.metadata.namespace !== "foreign"
    ) {
        name = name.toLowerCase();
        if (name in AttributeAliases) {
            name = AttributeAliases[name];
        }
    }
    return name;
}

/**
 * Serializes an assignment to an element property by adding relevant statements to either only
 * the init or the the init and update arrays, depending on whether or not the value is dynamic.
 * Resulting code for static looks something like this:
 * ```js
 * element.property = value;
 * // or
 * $.set_attribute(element, property, value);
 * });
 * ```
 * Resulting code for dynamic looks something like this:
 * ```js
 * let value;
 * $.template_effect(() => {
 * 	if (value !== (value = 'new value')) {
 * 		element.property = value;
 * 		// or
 * 		$.set_attribute(element, property, value);
 * 	}
 * });
 * ```
 * Returns true if attribute is deemed reactive, false otherwise.
 * @param {import('#ast').RegularElement} element
 * @param {import('estree').Identifier} node_id
 * @param {import('#ast').Attribute} attribute
 * @param {import('./types.js').ComponentContext} context
 * @returns {boolean}
 */
function serialize_element_attribute_update_assignment(
    element,
    node_id,
    attribute,
    context
) {
    const state = context.state;
    const name = getAttributeName(element, attribute, context);
    const is_svg = context.state.metadata.namespace === "svg";
    const is_mathml = context.state.metadata.namespace === "mathml";
    let [contains_call_expression, value] = serializeAttributeValue(
        attribute.value,
        context
    );

    // The foreign namespace doesn't have any special handling, everything goes through the attr function
    if (context.state.metadata.namespace === "foreign") {
        const statement = b.stmt(
            b.call("$.set_attribute", node_id, b.literal(name), value)
        );

        if (attribute.metadata?.dynamic) {
            const id = state.scope.generate(`${node_id.name}_${name}`);
            serialize_update_assignment(state, id, undefined, value, statement);
            return true;
        } else {
            state.init.push(statement);
            return false;
        }
    }

    if (name === "autofocus") {
        state.init.push(b.stmt(b.call("$.autofocus", node_id, value)));
        return false;
    }

    /** @type {import('estree').Statement} */
    let update;

    if (name === "class") {
        update = b.stmt(
            b.call(
                is_svg
                    ? "$.set_svg_class"
                    : is_mathml
                    ? "$.set_mathml_class"
                    : "$.set_class",
                node_id,
                value
            )
        );
    } else if (DOMProperties.includes(name)) {
        update = b.stmt(
            b.assignment("=", b.member(node_id, b.id(name)), value)
        );
    } else {
        const callee = name.startsWith("xlink")
            ? "$.set_xlink_attribute"
            : "$.set_attribute";
        update = b.stmt(b.call(callee, node_id, b.literal(name), value));
    }

    if (attribute.metadata?.dynamic) {
        if (contains_call_expression) {
            state.init.push(serialize_update(update));
        } else {
            state.update.push(update);
        }
        return true;
    } else {
        state.init.push(update);
        return false;
    }
}

/**
 * Serializes each class directive into something like `$.class_toogle(element, class_name, value)`
 * and adds it either to init or update, depending on whether or not the value or the attributes are dynamic.
 * @param {import('#ast').ClassDirective[]} class_directives
 * @param {import('estree').Identifier} element_id
 * @param {import('./types.js').ComponentContext} context
 * @param {boolean} is_attributes_reactive
 */
function serializeClassDirectives(
    class_directives,
    element_id,
    context,
    is_attributes_reactive
) {
    const state = context.state;
    for (const directive of class_directives) {
        const value = /** @type {import('estree').Expression} */ (
            context.visit(directive.expression)
        );
        const update = b.stmt(
            b.call(
                "$.toggle_class",
                element_id,
                b.literal(directive.name),
                value
            )
        );
        const contains_call_expression =
            directive.expression.type === "CallExpression";

        if (!is_attributes_reactive && contains_call_expression) {
            state.init.push(serialize_update(update));
        } else if (
            is_attributes_reactive ||
            directive.metadata.dynamic ||
            contains_call_expression
        ) {
            state.update.push(update);
        } else {
            state.init.push(update);
        }
    }
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
    const name = /** @type {import("estree").MemberExpression} */ (
        context.visit(
            node.type === "FilterExpression" ? node.name : node.callee
        )
    );

    const args = [];
    let hasEvent = false;

    const inOnDirective = context.path.at(-1)?.type === "OnDirective";

    for (const arg of node.arguments) {
        if (inOnDirective && object(arg)?.name === "_event") {
            hasEvent = true;
            args.push(arg);
        } else {
            args.push(
                /** @type {import("estree").Expression} */ (context.visit(arg))
            );
        }
    }

    const call = b.call(name, ...args);

    if (inOnDirective) {
        const patterns = [];
        if (hasEvent) patterns.push(b.id("_event"));
        return b.arrow(patterns, call);
    }

    return call;
}
