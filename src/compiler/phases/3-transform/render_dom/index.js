import { print } from "esrap";
import * as b from "./builders.js";
import { walk } from "zimmerframe";
import { clean_nodes } from "../utils.js";
import {
    EACH_INDEX_REACTIVE,
    EACH_IS_CONTROLLED,
    EACH_ITEM_IMMUTABLE,
    EACH_ITEM_REACTIVE,
} from "../../constants.js";
import { setScope } from "./scope.js";
import { filters } from "../../../../internal/client/runtime/filters.js";
import { renderStylesheet } from "../css/index.js";
import { buildLoadWrapper } from "./buildLoadWrapper.js";
import { HtmlTag } from "./visitors/HtmlTag.js";
import { Comment } from "./visitors/Comment.js";
import { sanitize_template_string } from "../../../utils/sanitize_template_string.js";
import { Fragment } from "./visitors/Fragment.js";
import { RegularElement } from "./visitors/RegularElement.js";
import { OnDirective } from "./visitors/OnDirective.js";
import { UseDirective } from "./visitors/UseDirective.js";
import { TransitionDirective } from "./visitors/TransitionDirective.js";
import { BindDirective } from "./visitors/BindDirective.js";

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
        analysis,
        options,
        hoisted: [b.importAll("$", "@pivotass/zvelte/internal/client")],
        node: /** @type {any} */ (null), // populated by the root node
        nonPropVars: [],
        nonPropSources: [],
        nonPropGetters: [],
        nonPropUnwraps: [],
        overrides: {},
        transform: {},
        events: new Set(),
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

    if (analysis.needs_props) {
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
                    options.async || !analysis.needs_props
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

        if (analysis.needs_props) {
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
 * @type {import("./types.js").ComponentVisitors}
 */
const templateVisitors = {
    // @ts-ignore
    Fragment,
    Comment,
    RegularElement,

    // @ts-ignore
    OnDirective,
    UseDirective,
    TransitionDirective,
    BindDirective,

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

    const { hoisted, trimmed } = clean_nodes(
        parent,
        node.fragment.nodes,
        context.path,
        undefined,
        context.state,
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
