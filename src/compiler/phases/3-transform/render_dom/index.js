import { print } from "esrap";
import * as b from "./builders.js";
import { walk } from "zimmerframe";
import { cleanNodes } from "../utils.js";
import {
    TEMPLATE_FRAGMENT,
    TEMPLATE_USE_IMPORT_NODE,
} from "../../constants.js";
import { Scope, setScope } from "./scope.js";
import { VoidElements } from "./constants.js";
import { sanitizeTemplateString } from "./sanitizeTemplateString.js";

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
        hoisted: [b.importAll("$", "svelte/internal/client")],
        node: /** @type {any} */ (null), // populated by the root node
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
                templateVisitors,
            ),
        )
    );

    const componentBlock = b.block(
        /** @type {import('estree').Statement[]} */ (template.body),
    );

    const body = [...state.hoisted];

    const component = b.fn(
        b.id(options.filename),
        [b.id("$$anchor"), b.id("$$props")],
        componentBlock,
    );

    body.push(b.exportDefault(component));

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
        context.state.options.preserveComments ?? false,
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

                add_template(template_name, [
                    b.template([b.quasi(state.template.join(""), true)], []),
                    b.literal(flags),
                ]);

                body.push(b.var(id, b.call(template_name)));
            }

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

    /** @typedef {Array<import('#ast').Text | import('#ast').ExpressionTag>} Sequence */

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

            state.template.push(" ");

            const text_id = get_node_id(expression(true), state, "text");

            const update = b.stmt(
                b.call(
                    "$.set_text",
                    text_id,
                    /** @type {import('estree').Expression} */ (
                        visit(node.expression)
                    ),
                ),
            );

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
                            b.call(
                                "$.stringify",
                                /** @type {import('estree').Expression} */ (
                                    visit(node.expression)
                                ),
                            ),
                        ),
                    ),
                );
            }

            expression = (is_text) =>
                is_text
                    ? b.call("$.sibling", text_id, b.true)
                    : b.call("$.sibling", text_id);
        } else {
            const text_id = get_node_id(expression(true), state, "text");

            state.template.push(" ");

            const [contains_call_expression, value] =
                serialize_template_literal(sequence, visit, state);

            const update = b.stmt(b.call("$.set_text", text_id, value));

            if (contains_call_expression && !within_bound_contenteditable) {
                state.init.push(serialize_update(update));
            } else if (
                sequence.some(
                    (node) =>
                        node.type === "ExpressionTag" && node.metadata.dynamic,
                ) &&
                !within_bound_contenteditable
            ) {
                state.update.push(update);
            } else {
                state.init.push(
                    b.stmt(
                        b.assignment(
                            "=",
                            b.member(text_id, b.id("nodeValue")),
                            value,
                        ),
                    ),
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

        if (node.type === "Text" || node.type === "ExpressionTag") {
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
                    const id = get_node_id(
                        expression(false),
                        state,
                        node.type === "RegularElement" ? node.name : "node",
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

    RegularElement(node, context) {
        context.state.template.push(`<${node.name}>`);

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
            state.options.preserveComments ?? false,
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
                        : context.state.node,
                ),
            true,
            { ...context, state },
        );

        if (!VoidElements.includes(node.name)) {
            context.state.template.push(`</${node.name}>`);
        }
    },

    // @ts-ignore
    MemberExpression(node, context) {
        const property = context.visit(node.property);
        const object = context.visit(node.object);

        let member = b.member(object, property, node.computed);

        if (context.path.at(-1)?.type !== "MemberExpression")
            member = b.member(b.id("$$props"), member);

        return member;
    },

    // @ts-ignore
    Identifier(node, context) {
        /** @type {import("estree").Identifier | import("estree").MemberExpression} */
        let id = b.id(node.name);

        if (context.path.at(-1)?.type !== "MemberExpression")
            id = b.member(b.id("$$props"), id);

        return id;
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
function get_node_id(expression, state, name) {
    let id = expression;

    if (id.type !== "Identifier") {
        id = b.id(state.scope.generate(name));

        state.init.push(b.var(id, expression));
    }
    return id;
}

/**
 * @param {Array<import('#ast').Text | import('#ast').ExpressionTag>} values
 * @param {(node: import('#ast').ZvelteNode) => any} visit
 * @param {import("./types.js").ComponentClientTransformState} state
 * @returns {[boolean, import('estree').TemplateLiteral]}
 */
function serialize_template_literal(values, visit, state) {
    /** @type {import('estree').TemplateElement[]} */
    const quasis = [];

    /** @type {import('estree').Expression[]} */
    const expressions = [];
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
                },
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
                    node.expression.value + "",
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
                                /** @type {import('estree').Expression} */ (
                                    visit(node.expression)
                                ),
                            ),
                        ),
                    ),
                );
                expressions.push(b.call("$.get", id));
            } else {
                expressions.push(b.call("$.stringify", visit(node.expression)));
            }
            quasis.push(b.quasi("", i + 1 === values.length));
        }
    }

    // TODO instead of this tuple, return a `{ dynamic, complex, value }` object. will DRY stuff out
    return [contains_call_expression, b.template(quasis, expressions)];
}
