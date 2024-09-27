import { print } from "esrap";
import * as b from "./builders.js";
import { walk } from "zimmerframe";
import { cleanNodes } from "../utils.js";
import {
    EACH_INDEX_REACTIVE,
    EACH_IS_CONTROLLED,
    EACH_ITEM_IMMUTABLE,
    EACH_ITEM_REACTIVE,
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
import { filters } from "../../../../internal/client/runtime/filters.js";
import { escapeHtml } from "../../../escaping.js";
import { renderStylesheet } from "../css/index.js";
import { buildLoadWrapper } from "./buildLoadWrapper.js";
import {
    build_render_statement,
    build_update,
} from "./visitors/shared/utils.js";
import { HtmlTag } from "./visitors/HtmlTag.js";
import { Comment } from "./visitors/Comment.js";

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
export function renderDom(source, ast, analysis, options, meta) {
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
        nonPropUnwraps: [],
        overrides: {},
        initProps: new Set(),
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
            namespace: "html",
            bound_contenteditable: false,
        },
        componentId: b.id(
            analysis.template.scope.generate(
                options.filename.replace(/\.[^\.]*$/, "").replace(/\./g, "_"),
            ),
        ),
    };

    for (const node of ast.imports) {
        state.hoisted.unshift(
            b.importDefault(node.specifier.name, node.source.value),
        );
    }

    let renderedCss;
    if (analysis.css && options.css === "injected") {
        renderedCss = renderStylesheet(source, analysis, options);
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

    if (analysis.css && renderedCss) {
        state.hoisted.push(
            b.const(
                "$$css",
                b.object([
                    b.prop("init", b.id("hash"), b.literal(analysis.css.hash)),
                    b.prop("init", b.id("code"), b.literal(renderedCss.code)),
                ]),
            ),
        );

        template.body.unshift(
            b.stmt(b.call("$.append_styles", b.id("$$anchor"), b.id("$$css"))),
        );
    }

    const component = b.function_declaration(
        state.componentId,
        [b.id("$$anchor")],
        b.block(/** @type {import('estree').Statement[]} */ (template.body)),
    );

    if (analysis.usesProps) {
        component.params.push(b.id("$$props"));
    }

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
                b.call(
                    "$.push",
                    options.async || !analysis.usesProps
                        ? b.id("$$props")
                        : b.assignment(
                              "=",
                              b.id("$$props"),
                              b.call("$.wrap", b.id("$$props")),
                          ),
                    b.true,
                ),
            ),
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
    } else {
        component.body.body.unshift(
            ...[...state.initProps].map((prop) =>
                b.stmt(b.member(b.id("$$props"), b.id(prop))),
            ),
        );

        if (analysis.usesProps) {
            component.body.body.unshift(
                b.stmt(
                    b.assignment(
                        "=",
                        b.id("$$props"),
                        b.call("$.wrap", b.id("$$props")),
                    ),
                ),
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

        /**
         * @type {Record<string, import("estree").Identifier>}
         */
        const exportSpecifiers = {};

        if (options.async.pendingComponent) {
            pendingId = b.id("__$$pending");
            exportSpecifiers[pendingId.name] = pendingId;
            body.unshift(
                b.importDefault(pendingId.name, options.async.pendingComponent),
            );
        }

        if (options.async.errorComponent) {
            errorId = b.id("__$$error");
            exportSpecifiers[errorId.name] = errorId;
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
                b.const(
                    "$$fetch",
                    b.call("$.create_load", b.literal(options.async.endpoint)),
                ),
            ),
            b.exportDefault(load),
        );

        if (Object.keys(exportSpecifiers).length) {
            body.push(b.exportSpecifiers(exportSpecifiers));
        }

        exportDefaultId = load.id;
    } else {
        body.push(b.exportDefault(component));
        exportDefaultId = component.id;
    }

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

    const { hoisted, trimmed, isTextFirst, isStandalone } = cleanNodes(
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

    const isSingleComponent =
        trimmed.length === 1 && trimmed[0].type === "Component";

    const is_single_child_not_needing_template =
        trimmed.length === 1 &&
        // @ts-expect-error
        (trimmed[0].type === "ZvelteFragment" ||
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

    if (isTextFirst) {
        // skip over inserted comment
        body.push(b.stmt(b.call("$.next")));
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
    } else if (isSingleComponent) {
        context.visit(trimmed[0], {
            ...state,
            node: b.id("$$anchor"),
        });
        body.push(...state.before_init, ...state.init);
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
            if (isStandalone) {
                // no need to create a template, we can just use the existing block's anchor
                processChildren(trimmed, () => b.id("$$anchor"), false, {
                    ...context,
                    state,
                });
            } else {
                /** @type {(is_text: boolean) => import("estree").Expression} */
                const expression = (is_text) =>
                    b.call("$.first_child", id, is_text && b.true);

                processChildren(trimmed, expression, false, {
                    ...context,
                    state,
                });

                let flags = TEMPLATE_FRAGMENT;

                if (state.metadata.context.template_needs_import_node) {
                    flags |= TEMPLATE_USE_IMPORT_NODE;
                }

                if (
                    state.template.length === 1 &&
                    state.template[0] === "<!>"
                ) {
                    // special case — we can use `$.comment` instead of creating a unique template
                    body.push(b.var(id, b.call("$.comment")));
                } else {
                    addTemplate(templateName, [
                        joinTemplate(state.template),
                        b.literal(flags),
                    ]);

                    body.push(b.var(id, b.call(templateName)));
                }

                close = b.stmt(b.call("$.append", b.id("$$anchor"), id));
            }
        }
    } else {
        body.push(...state.before_init, ...state.init);
    }

    if (state.update.length > 0) {
        body.push(build_render_statement(state.update));
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
 * @param {Array<string | import("estree").Expression>} items
 */
function joinTemplate(items) {
    let quasi = b.quasi("");
    const template = b.template([quasi], []);

    for (const item of items) {
        if (typeof item === "string") {
            quasi.value.cooked += item;
        } else {
            template.expressions.push(item);
            template.quasis.push((quasi = b.quasi("")));
        }
    }

    for (const quasi of template.quasis) {
        quasi.value.raw = sanitize_template_string(
            /** @type {string} */ (quasi.value.cooked),
        );
    }

    quasi.tail = true;

    return template;
}

/**
 * Processes an array of template nodes, joining sibling text/expression nodes
 * (e.g. `{a} b {c}`) into a single update function. Along the way it creates
 * corresponding template node references these updates are applied to.
 *
 * @param {import('#ast').ZvelteNode[]} nodes
 * @param {(is_text: boolean) => import('estree').Expression} initial
 * @param {boolean} isElement
 * @param {import('./types.js').ComponentContext} context
 */
function processChildren(nodes, initial, isElement, { visit, state }) {
    const within_bound_contenteditable = state.metadata.bound_contenteditable;
    let prev = initial;
    let skipped = 0;

    /** @typedef {Array<import("#ast").Text | import("#ast").ExpressionTag>} Sequence */
    /** @type {Sequence} */
    let sequence = [];

    /** @param {boolean} is_text */
    function get_node(is_text) {
        if (skipped === 0) {
            return prev(is_text);
        }

        return b.call(
            "$.sibling",
            prev(false),
            (is_text || skipped !== 1) && b.literal(skipped),
            is_text && b.true,
        );
    }

    /**
     * @param {boolean} is_text
     * @param {string} name
     */
    function flush_node(is_text, name) {
        const expression = get_node(is_text);
        let id = expression;

        if (id.type !== "Identifier") {
            id = b.id(state.scope.generate(name));
            state.init.push(b.var(id, expression));
        }

        prev = () => id;
        skipped = 1; // the next node is `$.sibling(id)`

        return id;
    }

    /**
     * @param {Sequence} sequence
     */
    function flush_sequence(sequence) {
        if (sequence.every((node) => node.type === "Text")) {
            skipped += 1;
            state.template.push(
                /** @type {import("#ast").Text[]} */ (sequence)
                    .map((node) => node.data)
                    .join(""),
            );
            return;
        }

        state.template.push(" ");

        const { has_state, has_call, value } = build_template_literal(
            sequence,
            visit,
            state,
        );

        // if this is a standalone `{expression}`, make sure we handle the case where
        // no text node was created because the expression was empty during SSR
        const is_text = sequence.length === 1;
        const id = flush_node(is_text, "text");

        const update = b.stmt(b.call("$.set_text", id, value));

        if (has_call && !within_bound_contenteditable) {
            state.init.push(build_update(update));
        } else if (has_state && !within_bound_contenteditable) {
            state.update.push(update);
        } else {
            state.init.push(
                b.stmt(
                    b.assignment("=", b.member(id, b.id("nodeValue")), value),
                ),
            );
        }
    }

    for (const node of nodes) {
        if (node.type === "Text" || node.type === "ExpressionTag") {
            sequence.push(node);
        } else {
            if (sequence.length > 0) {
                flush_sequence(sequence);
                sequence = [];
            }

            let child_state = state;

            if (is_static_element(node)) {
                skipped += 1;
            } else if (
                node.type === "ForBlock" &&
                nodes.length === 1 &&
                isElement
            ) {
                node.metadata.is_controlled = true;
            } else {
                const id = flush_node(
                    false,
                    node.type === "RegularElement" ? node.name : "node",
                );
                child_state = { ...state, node: id };
            }

            visit(node, child_state);
        }
    }

    if (sequence.length > 0) {
        flush_sequence(sequence);
    }

    // if there are trailing static text nodes/elements,
    // traverse to the last (n - 1) one when hydrating
    if (skipped > 1) {
        skipped -= 1;
        state.init.push(
            b.stmt(b.call("$.next", skipped !== 1 && b.literal(skipped))),
        );
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

    Comment,

    RegularElement(node, context) {
        if (node.name === "script") {
            context.state.metadata.context.template_contains_script_tag = true;
        }

        context.state.template.push(`<${node.name}`);
        let optionValue;

        if (node.name === "option") {
            let attr = /** @type {undefined | import("#ast").Attribute} */ (
                node.attributes.find(
                    (a) => a.type === "Attribute" && a.name === "value",
                )
            )?.value;

            if (
                !attr &&
                node.fragment.nodes.length === 1 &&
                node.fragment.nodes[0].type === "ExpressionTag"
            ) {
                attr = [node.fragment.nodes[0]];
            }

            if (attr) {
                optionValue = b.id(context.state.node.name + "_value");
                const value = serializeAttributeValue(attr, true, {
                    visit: context.visit,
                    state: {
                        ...context.state,
                        nonPropUnwraps: [
                            ...context.state.nonPropUnwraps,
                            ...context.state.nonPropSources,
                        ],
                    },
                });

                /** @type {import("estree").Expression} */
                let expr = b.assignment(
                    "=",
                    b.member(context.state.node, b.id("value")),
                    b.conditional(
                        b.binary(
                            b.id("null"),
                            "==",

                            b.assignment(
                                "=",
                                b.member(context.state.node, b.id("__value")),
                                value,
                            ),
                        ),
                        b.literal(""),
                        value,
                    ),
                );

                const dynamic =
                    attr !== true &&
                    attr.some((n) => {
                        if (n.type === "ExpressionTag") {
                            let hasIdentifier = false;

                            walk(n.expression, null, {
                                Identifier(_, { stop }) {
                                    hasIdentifier = true;
                                    stop();
                                },
                            });

                            return hasIdentifier;
                        }
                    });

                if (dynamic) {
                    context.state.init.push(
                        b.var(optionValue.name, b.object([])),
                    );
                    expr = b.call(
                        "$.template_effect",
                        b.arrow(
                            [],
                            b.block([
                                b.if(
                                    b.binary(
                                        optionValue,
                                        "!==",
                                        b.assignment("=", optionValue, value),
                                    ),
                                    b.block([b.stmt(expr)]),
                                ),
                            ]),
                        ),
                    );
                }

                context.state[dynamic ? "update" : "init"].push(b.stmt(expr));
            }
        }

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

                    if (attr.name === "value" && optionValue) {
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
                            let method = "$.bind_value";

                            if (node.name === "select") {
                                method = "$.bind_select_value";
                            }

                            const call = b.call(
                                method,
                                context.state.node,
                                get,
                                set,
                            );

                            context.state.after_update.push(b.stmt(call));
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

                            context.state.init.push(b.stmt(call));
                            break;
                        }

                        case "checked": {
                            const call = b.call(
                                "$.bind_checked",
                                context.state.node,
                                get,
                                set,
                            );

                            context.state.after_update.push(b.stmt(call));
                            break;
                        }

                        case "files": {
                            const call = b.call(
                                "$.bind_files",
                                context.state.node,
                                get,
                                set,
                            );
                            context.state.after_update.push(b.stmt(call));
                            break;
                        }

                        case "group": {
                            /** @type {import('estree').CallExpression[]} */
                            const indexes = [];
                            for (const parent_each_block of attr.metadata
                                .parent_each_blocks) {
                                indexes.push(parent_each_block.metadata.index);
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

                        case "textContent":
                        case "innerText":
                        case "innerHTML": {
                            const call = b.call(
                                "$.bind_content_editable",
                                b.literal(attr.name),
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
            context.state.init.push(
                b.call("$.remove_input_defaults", context.state.node),
            );
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

        let arg = context.state.node;

        // If `hydrate_node` is set inside the element, we need to reset it
        // after the element has been hydrated
        let needsReset = trimmed.some((node) => node.type !== "Text");

        // The same applies if it's a `<template>` element, since we need to
        // set the value of `hydrate_node` to `node.content`
        if (node.name === "template") {
            needsReset = true;
            context.state.init.push(b.stmt(b.call("$.hydrate_template", arg)));
            arg = b.member(arg, b.id("content"));
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

        if (needsReset) {
            context.state.init.push(
                b.stmt(b.call("$.reset", context.state.node)),
            );
        }

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

        const call = b.call("$.snippet", state.node, b.thunk(callee));

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

            const callee = b.call(
                "$.filter",
                context.state.options.hasJS ? b.id("$$prop") : b.id("$$props"),
                b.literal(node.name.name),
            );

            const call = b.call(
                b.member(callee, b.id(node.name.name)),
                ...args,
            );
            // @ts-ignore
            call.optional = node.optional;
            return call;
        } else {
            return serializeFunction(node, context);
        }
    },

    // @ts-ignore
    AssignmentExpression(node, context) {
        return b.assignment(
            node.operator === "~=" ? "+=" : node.operator,
            /** @type {import("estree").Pattern} */ (context.visit(node.left)),
            /** @type {import("estree").Expression} */ (
                context.visit(node.right)
            ),
        );
    },

    // @ts-ignore
    MemberExpression(node, { visit, state, path }) {
        const object = /** @type {import("estree").Expression} */ (
            visit(node.object)
        );

        const property = /** @type {import("estree").Expression} */ (
            visit(node.property)
        );

        let member = b.member(object, property, node.computed, node.optional);

        if (
            !state.ignoreScope &&
            member.object.type === "Identifier" &&
            member.property.type === "Identifier"
        ) {
            if (state.overrides[member.object.name]) {
                const o = state.overrides[member.object.name];
                member = b.member(o, property);
            } else if (state.nonPropUnwraps.includes(member.object.name)) {
                member = b.member(member.object, property);
            } else if (state.nonPropSources.includes(member.object.name)) {
                member = b.member(b.call("$.get", member.object), property);
            } else if (state.nonPropGetters.includes(member.object.name)) {
                member = b.member(b.call(member.object), property);
            } else if (!state.nonPropVars.includes(member.object.name)) {
                if (!state.options.hasJS)
                    state.initProps.add(member.object.name);

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
            if (state.overrides[id.name]) {
                id = state.overrides[id.name];
            } else if (state.nonPropUnwraps.includes(id.name)) {
                id = id;
            } else if (state.nonPropSources.includes(id.name)) {
                id = b.call("$.get", id);
            } else if (state.nonPropGetters.includes(id.name)) {
                id = b.call(id);
            } else if (!state.nonPropVars.includes(id.name)) {
                if (!state.options.hasJS) state.initProps.add(id.name);

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

                case "iterable": {
                    const value = /** @type {import("estree").Expression} */ (
                        visit(node.left)
                    );

                    const iterator = b.unary(
                        "typeof",
                        b.member(value, b.id("Symbol.iterator"), true, true),
                    );

                    return b.binary(
                        iterator,
                        node.not ? "!==" : "===",
                        b.literal("function"),
                    );
                }
            }
        }

        return b.binary(
            /** @type {import("estree").Expression} */ (visit(node.left)),
            node.not ? "!==" : "===",
            /** @type {import("estree").Expression} */ (visit(node.right)),
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

    HtmlTag,

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
        const meta = node.metadata;
        if (!meta.is_controlled) {
            state.template.push("<!>");
        }

        const call = b.call("$.each", state.node);

        // The runtime needs to know what kind of for block this is in order to optimize for the
        // key === item (we avoid extra allocations). In that case, the item doesn't need to be reactive.
        // We can guarantee this by knowing that in order for the item of the for block to change, they
        // would need to mutate the key/item directly in the array. Given that in runes mode we use ===
        // equality, we can apply a fast-path (as long as the index isn't reactive).
        let forType = EACH_ITEM_IMMUTABLE;
        let for_item_is_reactive = true;

        /**
         * @type {import('estree').Expression}
         */
        let key = b.id("$.index");

        if (
            node.key &&
            (node.key.type !== "Identifier" ||
                !node.index ||
                node.key.name !== node.index.name)
        ) {
            // forType |= EACH_KEYED;

            key = b.arrow([b.id("$$key"), b.id("$$index")], b.id("$$key"));

            // If there's a destructuring, then we likely need the generated $$index
            if (node.index || node.context.type !== "Identifier") {
                forType |= EACH_INDEX_REACTIVE;
            }

            if (
                node.key.type === "Identifier" &&
                node.context.type === "Identifier" &&
                node.context.name === node.key.name &&
                (forType & EACH_INDEX_REACTIVE) === 0
            ) {
                // Fast-path for when the key === item
                for_item_is_reactive = false;
            } else {
                forType |= EACH_ITEM_REACTIVE;
            }
        } else {
            forType |= EACH_ITEM_REACTIVE;
        }

        if (meta.is_controlled) {
            forType |= EACH_IS_CONTROLLED;
        }

        const nonPropSources = [...state.nonPropSources];
        const overrides = { ...state.overrides };

        overrides.loop = b.id("loop");

        if (node.index) {
            nonPropSources.push(node.index.name);
        }

        if (for_item_is_reactive) {
            overrides[node.context.name] = b.call("$.get", node.context);
        }

        // @ts-ignore
        const body = /** @type {import('estree').BlockStatement} */ (
            visit(node.body, {
                ...state,
                nonPropSources,
                overrides,
            })
        );

        const isInForBlock = path.some((node) => node.type === "ForBlock");

        const array = b.call(
            "$.iterable",
            /** @type {import("estree").Expression} */ (visit(node.expression)),
        );
        const unwrapIndex = b.id("$$index");
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
            b.literal(forType),
            b.thunk(array),
            key,
            b.arrow(
                [b.id("$$anchor"), b.id(node.context.name), b.id("$$index")],
                body,
            ),
        );

        if (node.fallback) {
            // @ts-ignore
            const fallback = /** @type {import('estree').BlockStatement} */ (
                visit(node.fallback)
            );

            call.arguments.push(b.arrow([b.id("$$anchor")], fallback));
        }

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

    AwaitBlock(node, context) {
        context.state.template.push("<!>");

        let then_block;
        let catch_block;

        if (node.then) {
            /** @type {import('estree').Pattern[]} */
            const args = [b.id("$$anchor")];
            const overrides = { ...context.state.overrides };

            if (node.value) {
                args.push(node.value);
                overrides[node.value.name] = b.call("$.get", node.value);
            }

            const block = /** @type {any} */ (
                context.visit(node.then, {
                    ...context.state,
                    overrides,
                })
            );

            then_block = b.arrow(args, block);
        }

        if (node.catch) {
            /** @type {import('estree').Pattern[]} */
            const args = [b.id("$$anchor")];
            const overrides = { ...context.state.overrides };

            if (node.error) {
                args.push(node.error);
                overrides[node.error.name] = node.error;
            }

            const block = /** @type {any} */ (
                context.visit(node.catch, {
                    ...context.state,
                    overrides,
                })
            );

            catch_block = b.arrow(args, block);
        }

        context.state.init.push(
            b.stmt(
                b.call(
                    "$.await",
                    context.state.node,
                    b.thunk(
                        /** @type {import('estree').Expression} */ (
                            context.visit(node.expression)
                        ),
                    ),
                    node.pending
                        ? b.arrow(
                              [b.id("$$anchor")],
                              /** @type {any} */ (context.visit(node.pending)),
                          )
                        : b.literal(null),
                    then_block,
                    catch_block,
                ),
            ),
        );
    },

    Component(node, context) {
        // This is the "x" of this example -> {% import Component from "x" %}
        // It is optional, if it's not found it will assume that this is a dynamic component that comes from the props
        const source = node.metadata.source;

        context.state.template.push("<!>");

        const nodeId = context.state.node;
        const statement = serializeComponentProps(
            node,
            context,
            source
                ? (props, bindThis) =>
                      bindThis(b.call(node.name, nodeId, props))
                : getDynamicComponentBuilder(context, nodeId, {
                      type: "Identifier",
                      name: node.name,
                      start: -1,
                      end: -1,
                  }),
        );

        context.state.init.push(statement);
    },

    ZvelteComponent(node, context) {
        context.state.template.push("<!>");

        const nodeId = context.state.node;
        const statement = serializeComponentProps(
            node,
            context,
            getDynamicComponentBuilder(context, nodeId, node.expression),
        );

        context.state.init.push(statement);
    },

    ZvelteSelf(node, context) {
        context.state.template.push("<!>");

        const nodeId = context.state.node;
        const id = context.state.componentId;
        const statement = serializeComponentProps(
            node,
            context,
            (props, bindThis) => bindThis(b.call(id, nodeId, props)),
        );

        context.state.init.push(statement);
    },

    ZvelteHead(node, context) {
        context.state.init.push(
            b.stmt(
                b.call(
                    "$.head",
                    b.arrow(
                        [b.id("$$anchor")],
                        /** @type {any} */ (context.visit(node.fragment)),
                    ),
                ),
            ),
        );
    },

    TitleElement(node, { state, visit }) {
        // TODO throw validation error when attributes present / when children something else than text/expression tags
        if (
            node.fragment.nodes.length === 1 &&
            node.fragment.nodes[0].type === "Text"
        ) {
            state.init.push(
                b.stmt(
                    b.assignment(
                        "=",
                        b.member(b.id("$.document"), b.id("title")),
                        b.literal(
                            /** @type {import('#ast').Text} */ (
                                node.fragment.nodes[0]
                            ).data,
                        ),
                    ),
                ),
            );
        } else {
            const values = [];
            let isDynamic = false;
            for (const child of node.fragment.nodes) {
                if (child.type !== "Text" && child.type !== "ExpressionTag")
                    throw new Error(
                        "`<title>` can only contain text and {{ tags }}",
                    );

                if (child.type === "ExpressionTag") {
                    isDynamic = true;
                }

                values.push(child);
            }

            const assignment = b.assignment(
                "=",
                b.member(b.id("$.document"), b.id("title")),
                serializeAttributeValue(values, true, { visit, state }),
            );

            state.update.push(
                isDynamic
                    ? b.stmt(b.call("$.template_effect", b.thunk(assignment)))
                    : b.stmt(assignment),
            );
        }
    },
};

/**
 * @param {import("#ast").ZvelteSelf| import("#ast").ZvelteComponent | import("#ast").Component} node
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
            context.state.nonPropVars.push(child.expression.name);
            context.visit(child, {
                ...context.state,
                init: privateScope,
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
                    const parent = path.at(-1);
                    if (
                        parent &&
                        parent.type === "Property" &&
                        !parent.computed
                    ) {
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

    const call = b.call(name, ...args);
    // @ts-ignore
    call.optional = node.optional;
    return call;
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
 * Extracts all identifiers from a pattern.
 * @param {import("#ast").Expression} param
 * @param {import("#ast").Identifier[]} [nodes]
 * @returns {import("#ast").Identifier[]}
 */
export function extract_identifiers(param, nodes = []) {
    switch (param.type) {
        case "Identifier":
            nodes.push(param);
            break;

        case "AssignmentExpression":
            extract_identifiers(param.left, nodes);
            break;
    }

    return nodes;
}

/**
 * @param {import("estree").Pattern} node
 * @param {import("zimmerframe").Context<import("#ast").ZvelteNode, import("./types.js").ComponentClientTransformState>} context
 * @returns {{ id: import("estree").Pattern, declarations: null | import("estree").Statement[] }}
 */
export function create_derived_block_argument(node, context) {
    if (node.type === "Identifier") {
        return { id: node, declarations: null };
    }

    const pattern = /** @type {import('estree').Pattern} */ (
        context.visit(/** @type {any} */ (node))
    );
    const identifiers = extract_identifiers(/** @type {any} */ (node));

    const id = b.id("$$source");
    const value = b.id("$$value");

    const block = b.block([
        b.var(pattern, b.call("$.get", id)),
        b.return(
            b.object(
                identifiers.map((identifier) =>
                    b.prop("init", identifier, identifier),
                ),
            ),
        ),
    ]);

    const declarations = [
        b.var(value, create_derived(context.state, b.thunk(block))),
    ];

    for (const id of identifiers) {
        declarations.push(
            b.var(
                id,
                create_derived(
                    context.state,
                    b.thunk(b.member(b.call("$.get", value), id)),
                ),
            ),
        );
    }

    return { id, declarations };
}

/**
 * @param {import('./types.js').ComponentClientTransformState} state
 * @param {import('estree').Expression} arg
 */
export function create_derived(state, arg) {
    return b.call("$.derived", arg);
}

/**
 * @param {import("./types.js").ComponentContext} context
 * @param {*} nodeId
 * @param {import("#ast").Expression} expression
 *
 * @returns {Parameters<typeof serializeComponentProps>[2]}
 */
function getDynamicComponentBuilder(context, nodeId, expression) {
    return (props, bindThis) =>
        b.call(
            "$.component",
            nodeId,
            b.thunk(
                /** @type {import('estree').Expression} */ (
                    context.visit(expression)
                ),
            ),
            b.arrow(
                [b.id("$$anchor"), b.id("$$component")],
                b.block([
                    b.stmt(
                        bindThis(
                            b.call("$$component", b.id("$$anchor"), props),
                        ),
                    ),
                ]),
            ),
        );
}

/**
 * @param {import("#ast").ZvelteNode} node
 */
function is_static_element(node) {
    if (node.type !== "RegularElement") return false;
    if (node.fragment.metadata.dynamic) return false;

    for (const attribute of node.attributes) {
        if (attribute.type !== "Attribute") {
            return false;
        }

        if (is_event_attribute(attribute)) {
            return false;
        }

        if (attribute.value !== true && !is_text_attribute(attribute)) {
            return false;
        }

        if (node.name === "option" && attribute.name === "value") {
            return false;
        }

        if (node.name.includes("-")) {
            return false; // we're setting all attributes on custom elements through properties
        }
    }

    return true;
}

/**
 * Returns true if the attribute contains a single static text node.
 * @param {import("#ast").Attribute} attribute
 * @returns {attribute is import("#ast").Attribute & { value: [import("#ast").Text] }}
 */
export function is_text_attribute(attribute) {
    return (
        Array.isArray(attribute.value) &&
        attribute.value.length === 1 &&
        attribute.value[0].type === "Text"
    );
}

/**
 * Returns true if the attribute starts with `on` and contains a single expression node.
 * @param {import("#ast").Attribute} attribute
 * @returns {attribute is import("#ast").Attribute & { value: [import("#ast").ExpressionTag] | import("#ast").ExpressionTag }}
 */
export function is_event_attribute(attribute) {
    return (
        is_expression_attribute(attribute) && attribute.name.startsWith("on")
    );
}

/**
 * Returns true if the attribute contains a single expression node.
 * In Svelte 5, this also includes a single expression node wrapped in an array.
 * TODO change that in a future version
 * @param {import("#ast").Attribute} attribute
 * @returns {attribute is import("#ast").Attribute & { value: [import("#ast").ExpressionTag] | import("#ast").ExpressionTag }}
 */
export function is_expression_attribute(attribute) {
    return (
        (attribute.value !== true && !Array.isArray(attribute.value)) ||
        (Array.isArray(attribute.value) &&
            attribute.value.length === 1 &&
            attribute.value[0].type === "ExpressionTag")
    );
}

/**
 * @param {Array<import("#ast").Text | import("#ast").ExpressionTag>} values
 * @param {(node: import("#ast").ZvelteNode, state: any) => any} visit
 * @param {import("./types.js").ComponentClientTransformState} state
 * @returns {{ value: import("estree").Expression, has_state: boolean, has_call: boolean }}
 */
export function build_template_literal(values, visit, state) {
    /** @type {import("estree").Expression[]} */
    const expressions = [];

    let quasi = b.quasi("");
    const quasis = [quasi];

    const { states, calls } = get_states_and_calls(values);

    let has_call = calls > 0;
    let has_state = states > 0;
    let contains_multiple_call_expression = calls > 1;

    for (let i = 0; i < values.length; i++) {
        const node = values[i];

        if (node.type === "Text") {
            quasi.value.cooked += node.data;
        } else if (
            node.type === "ExpressionTag" &&
            (node.expression.type === "StringLiteral" ||
                node.expression.type === "NullLiteral" ||
                node.expression.type === "BooleanLiteral" ||
                node.expression.type === "NumericLiteral")
        ) {
            if (node.expression.value != null) {
                quasi.value.cooked += node.expression.value + "";
            }
        } else {
            if (contains_multiple_call_expression) {
                const id = b.id(state.scope.generate("stringified_text"));
                state.init.push(
                    b.const(
                        id,
                        create_derived(
                            state,
                            b.thunk(
                                b.logical(
                                    /** @type {import("estree").Expression} */ (
                                        visit(node.expression, state)
                                    ),
                                    "??",
                                    b.literal(""),
                                ),
                            ),
                        ),
                    ),
                );
                expressions.push(b.call("$.get", id));
            } else if (values.length === 1) {
                // If we have a single expression, then pass that in directly to possibly avoid doing
                // extra work in the template_effect (instead we do the work in set_text).
                return {
                    value: visit(node.expression, state),
                    has_state,
                    has_call,
                };
            } else {
                expressions.push(
                    b.logical(
                        visit(node.expression, state),
                        "??",
                        b.literal(""),
                    ),
                );
            }

            quasi = b.quasi("", i + 1 === values.length);
            quasis.push(quasi);
        }
    }

    for (const quasi of quasis) {
        quasi.value.raw = sanitize_template_string(
            /** @type {string} */ (quasi.value.cooked),
        );
    }

    const value = b.template(quasis, expressions);

    return { value, has_state, has_call };
}

/**
 * @param {string} str
 * @returns {string}
 */
export function sanitize_template_string(str) {
    return str.replace(/(`|\${|\\)/g, "\\$1");
}

/**
 * @param {Array<import("#ast").Text | import("#ast").ExpressionTag>} values
 */
export function get_states_and_calls(values) {
    let states = 0;
    let calls = 0;
    for (let i = 0; i < values.length; i++) {
        const node = values[i];

        if (node.type === "ExpressionTag") {
            if (node.metadata.expression.has_call) {
                calls++;
            }
            if (node.metadata.expression.has_state) {
                states++;
            }
        }
    }

    return { states, calls };
}
