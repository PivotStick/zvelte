import * as svelte from "svelte";
import { addTemplatesToAST } from "./astToTemplate.js";
import { parse } from "../../../compiler/phases/1-parse/index.js";
import { getFilter } from "../runtime/filters.js";
import { findScopeFrom, searchInScope } from "../shared.js";
import { getComponentByKey, registerComponent } from "../runtime/components.js";

// @ts-ignore
import * as $ from "svelte/internal/client";
import {
    EACH_INDEX_REACTIVE,
    EACH_ITEM_REACTIVE,
    EACH_KEYED,
    UNINITIALIZED,
} from "../../../compiler/phases/constants.js";
import { walk } from "zimmerframe";
import { cleanNodes } from "../../../compiler/phases/3-transform/utils.js";
import { hash } from "../../../compiler/index.js";

/**
 * @typedef {import("#ast").ZvelteNode} ZvelteNode
 * @typedef {import("../types.js").State} State
 *
 * @typedef {(node: ZvelteNode | _, state?: State) => ZvelteNode | _} Visit
 */

/**
 * @param {() => void} callback
 * @param {*} props
 */
export function contextualizeComponent(callback, props) {
    const component = svelte.mount(
        // @ts-ignore
        () => {
            $.push(props, true);
            callback();
            $.pop();
        },
        {
            target: document.body,
        }
    );
    return {
        flush() {
            svelte.unmount(component);
        },
    };
}

/**
 * @template Methods
 * @param {{
 *  ast: ReturnType<typeof parse>;
 *  initScope?: () => Record<string, any>;
 *  key?: any;
 *  init?: (args: import("../types.js").ComponentInitArgs<any>) => Methods
 * }} args
 */
export function createComponent({ init, ast, key, initScope }) {
    /**
     * @type {State["options"]}
     */
    const options = {
        preserveWhitespaces: false,
        preserveComments: true,
    };

    addTemplatesToAST(ast, options);

    /**
     * @type {Methods}
     */
    let methods;

    const component = (
        /** @type {any} */ $$anchor,
        /** @type {Record<string, any>} */ $$props
    ) => {
        if (init) $.push($$props, true);

        const fragment = getRoot(ast);
        const scope = initScope?.() ?? {};

        /**
         * @type {import("../types.js").State}
         */
        const state = {
            scope: [scope, $$props],
            els: {},
            bindingGroups: {},
            currentNode: fragment,
            options,
        };

        if (init) {
            methods = init({
                props: $$props,
                els: state.els,
                scope,
            });
        }

        walk(ast, state, visitors);

        $.append($$anchor, fragment);

        // @ts-ignore
        if (init) return $.pop(methods);
    };

    /**
     * @param {{ target: HTMLElement; props: any; hydrate?: boolean; }} args
     */
    const mount = ({ target, props = {}, hydrate = false }) => {
        props = $.proxy(props);

        // @ts-ignore
        const instance = (hydrate ? svelte.hydrate : svelte.mount)(component, {
            target,
            props,
        });

        return {
            // @ts-ignore
            methods,
            destroy() {
                svelte.unmount(instance);
            },
        };
    };

    if (key) {
        registerComponent(key, component);
    } else {
        mount.component = component;
    }

    return mount;
}

/**
 * @template Props
 * @template Methods
 * @param {{
 *   target: HTMLElement;
 *   scope?: Record<string, any>;
 *   props?: Props;
 *   source?: string;
 *   init?: (args: import("../types.js").ComponentInitArgs<Props>) => Methods;
 *   hydrate?: boolean;
 *   options?: Parameters<typeof parse>[1];
 * }} args
 */
export function mount({
    target,
    scope = {},
    source = "",
    // @ts-expect-error
    props = {},
    init,
    hydrate,
    options,
}) {
    const mount = createComponent({
        init,
        initScope: () => scope,
        ast: parse(source, options),
    });

    return mount({ target, props, hydrate });
}

/**
 * @param {*} value
 * @param {import("#ast").Identifier | import("#ast").MemberExpression} expression
 * @param {Visit} visit
 * @param {import("../types.js").State} ctx
 */
function setInScope(value, expression, visit, ctx) {
    let { object, key } = findScopeFromExpression(expression, visit, ctx);

    object[key] = value;
}

/**
 * @param {import("#ast").Identifier | import("#ast").MemberExpression} expression
 * @param {Visit} visit
 * @param {import("../types.js").State} ctx
 * @param {((object: any, key: string) => void)=} onfallback
 */
function findScopeFromExpression(expression, visit, ctx, onfallback) {
    let object;
    let key;

    if (expression.type === "MemberExpression") {
        object =
            /** @type {any} */ (visit(expression.object))._ ?? UNINITIALIZED;
        if (expression.computed === true) {
            key = /** @type {any} */ (visit(expression.property))._;
        } else {
            key = expression.property.name;
        }
    } else {
        object = findScopeFrom(expression.name, ctx.scope) ?? UNINITIALIZED;
        key = expression.name;
    }

    if (object === UNINITIALIZED) {
        // Get the last scope that is not the props
        object =
            ctx.scope.length === 2
                ? ctx.scope[0]
                : ctx.scope[ctx.scope.length - 1];

        onfallback?.(object, key);
    }

    return {
        object,
        key,
    };
}

/**
 * @typedef {{ type: ""; _: any }} _
 *
 * @type {import("zimmerframe").Visitors<ZvelteNode | _, State>}
 */
const visitors = {
    Root(node, { visit }) {
        visit(node.fragment);
    },

    Fragment(node, { state, visit, path }) {
        const parent = /** @type {ZvelteNode} */ (path[path.length - 1]);
        const { hoisted, trimmed } = cleanNodes(
            parent,
            node.nodes,
            /** @type {ZvelteNode[]} */ (path),
            undefined,
            state.options.preserveWhitespaces,
            state.options.preserveComments
        );

        hoisted.forEach((node) => {
            visit(node);
        });

        trimmed.forEach((child, i) => {
            const isText = child.type === "Text";

            let currentNode =
                i === 0
                    ? // @ts-ignore
                      $.first_child(state.currentNode, isText)
                    : $.sibling(state.currentNode, isText);

            if (!currentNode)
                throw new Error(
                    `Expected a node "${child.type}" ${
                        child.type === "RegularElement"
                            ? `<${child.name} />`
                            : ""
                    }`
                );

            if (currentNode instanceof Comment && currentNode.data === "$$") {
                const empty = document.createTextNode("");
                currentNode.replaceWith(empty);
                currentNode = empty;
            }

            state.currentNode = currentNode;
            visit(child, { ...state, currentNode: state.currentNode });
        });
    },

    RegularElement(node, { visit }) {
        for (const attr of node.attributes) {
            visit(attr);
        }

        visit(node.fragment);
    },

    Attribute(node, { state, visit, path }) {
        const parent = path[path.length - 1];

        if (
            node.value !== true &&
            (node.value.length > 1 || node.value[0].type !== "Text")
        ) {
            const element = /** @type {HTMLElement} */ (state.currentNode);

            const hasBindGroup =
                parent?.type === "RegularElement" &&
                parent.attributes.some(
                    (a) => a.type === "BindDirective" && a.name === "group"
                );

            if (
                element instanceof HTMLInputElement &&
                node.name === "value" &&
                hasBindGroup
            ) {
                return;
            }

            if (
                (element instanceof HTMLButtonElement &&
                    node.name === "disabled") ||
                (element instanceof HTMLInputElement &&
                    (node.name === "value" ||
                        node.name === "checked" ||
                        node.name === "disabled"))
            ) {
                $.render_effect(() => {
                    // @ts-ignore
                    element[node.name] = computeAttributeValue(
                        node,
                        visit,
                        state
                    );
                });
            } else {
                $.render_effect(() => {
                    $.set_attribute(
                        element,
                        node.name,
                        computeAttributeValue(node, visit, state)
                    );
                });
            }
        }
    },

    BindDirective(node, { visit, state, path }) {
        const ex = node.expression;
        const parent = path[path.length - 1];

        const get = () => /** @type {_} */ (visit(ex))._;
        const set = (/** @type {any} */ $$value) =>
            setInScope($$value, ex, visit, state);

        switch (node.name) {
            case "value": {
                const element = /** @type {HTMLInputElement} */ (
                    state.currentNode
                );
                $.bind_value(element, get, set);
                break;
            }

            case "checked": {
                const element = /** @type {HTMLInputElement} */ (
                    state.currentNode
                );
                $.bind_checked(element, get, set);
                break;
            }

            case "this": {
                const element = /** @type {HTMLElement} */ (state.currentNode);
                const _ctx = {
                    ...state,
                    scope: [state.els],
                };
                $.bind_this(
                    element,
                    ($$value) => setInScope($$value, ex, visit, _ctx),
                    () => /** @type {_} */ (visit(ex, _ctx))._
                );
            }

            case "group": {
                const element = /** @type {HTMLInputElement} */ (
                    state.currentNode
                );
                const id = hash(JSON.stringify(node.expression));
                const bindingGroup = (state.bindingGroups[id] ??= []);
                const groupIndex = [];
                const loop = searchInScope("loop", state.scope);
                if (loop?.parent) {
                    groupIndex.push(loop.parent.index0);
                }

                $.remove_input_attr_defaults(element);

                const valueAttribute =
                    parent?.type === "RegularElement" &&
                    parent.attributes.find(
                        (attr) =>
                            attr.type === "Attribute" && attr.name === "value"
                    );

                /**
                 * @type {(() => any)=}
                 */
                let getValue;
                if (
                    typeof valueAttribute !== "boolean" &&
                    valueAttribute?.type === "Attribute"
                ) {
                    /** @type {any} */
                    let input_value;
                    const v = (getValue = () =>
                        computeAttributeValue(valueAttribute, visit, state));

                    $.template_effect(() => {
                        if (input_value !== (input_value = v())) {
                            element.value =
                                // @ts-ignore
                                null == (element.__value = v()) ? "" : v();
                        }
                    });
                }

                $.bind_group(
                    bindingGroup,
                    // @ts-ignore
                    groupIndex,
                    element,
                    () => {
                        getValue?.();
                        return get();
                    },
                    set
                );
            }

            default:
                break;
        }
    },

    TransitionDirective(node, { visit, state }) {
        const element = /** @type {HTMLElement} */ (state.currentNode);
        const args = node.expression;

        const INTRO = 1;
        const OUTRO = 2;
        const BOTH = 3;
        const GLOBAL = 4;

        let getParams = null;
        let flag = node.intro && node.outro ? BOTH : node.intro ? INTRO : OUTRO;

        if (args) {
            getParams = () => /** @type {_} */ (visit(args))._;
        }

        if (node.modifiers.includes("global")) {
            flag += GLOBAL;
        }

        $.transition(
            flag,
            element,
            () => searchInScope(node.name, state.scope),
            getParams
        );
    },

    OnDirective(node, { visit, state }) {
        const element = /** @type {HTMLElement} */ (state.currentNode);
        const ex = node.expression;

        if (ex) {
            $.event(
                node.name,
                element,
                (_event) => {
                    visit(ex, pushNewScope(state, { _event }));
                },
                false
            );
        } else {
            // @ts-ignore
            $.event(node.name, element, function ($$arg) {
                // @ts-ignore
                $.bubble_event.call(this, ctx.scope.at(1), $$arg);
            });
        }
    },

    ClassDirective(node, { visit, state }) {
        const element = /** @type {HTMLElement} */ (state.currentNode);
        const name = node.name;
        const ex = node.expression;

        $.render_effect(() => {
            $.toggle_class(element, name, /** @type {_} */ (visit(ex))._);
        });
    },

    CallExpression(node, { visit }) {
        const fn = /** @type {_} */ (visit(node.callee))._;
        const args = node.arguments.map(
            (arg) => /** @type {_} */ (visit(arg))._
        );

        return { type: "", _: fn(...args) };
    },

    FilterExpression(node, { visit }) {
        const fn =
            /** @type {_} */ (visit(node.name))._ ?? getFilter(node.name.name);
        const args = node.arguments.map(
            (arg) => /** @type {_} */ (visit(arg))._
        );

        return { type: "", _: fn(...args) };
    },

    ConditionalExpression(node, { visit }) {
        const test = /** @type {_} */ (visit(node.test))._;

        return {
            type: "",
            _: test
                ? /** @type {_} */ (visit(node.consequent))._
                : /** @type {_} */ (visit(node.alternate))._,
        };
    },

    ObjectExpression(node, { visit }) {
        /** @type {any} */
        const object = {};

        node.properties.forEach((property) => {
            object[
                property.key.type === "StringLiteral"
                    ? property.key.value
                    : property.key.name
            ] = /** @type {_} */ (visit(property.value))._;
        });

        return { type: "", _: object };
    },

    ArrayExpression(node, { visit }) {
        /** @type {any[]} */
        const array = [];

        node.elements.forEach((element) => {
            array.push(/** @type {_} */ (visit(element))._);
        });

        return { type: "", _: array };
    },

    LogicalExpression(node, { visit }) {
        const left = /** @type {_} */ (visit(node.left))._;
        const right = () => /** @type {_} */ (visit(node.right))._;

        switch (node.operator) {
            case "??":
                return { type: "", _: left ?? right() };
            case "and":
                return { type: "", _: left && right() };
            case "||":
            case "or":
                return { type: "", _: left || right() };

            default:
                throw new Error(
                    `Unhandled LogicalExpression operator "${node.operator}"`
                );
        }
    },

    BinaryExpression(node, { visit }) {
        const left = /** @type {_} */ (visit(node.left))._;
        const right = /** @type {_} */ (visit(node.right))._;

        switch (node.operator) {
            case "~":
                return { type: "", _: String(left) + String(right) };

            case "+":
                return { type: "", _: Number(left) + Number(right) };

            case "-":
                return { type: "", _: left - right };

            case "==":
                return { type: "", _: left == right };

            case "!=":
                return { type: "", _: left != right };

            case ">=":
                return { type: "", _: left >= right };

            case "<=":
                return { type: "", _: left <= right };

            case ">":
                return { type: "", _: left > right };

            case "<":
                return { type: "", _: left < right };

            case "/":
                return { type: "", _: left / right };

            case "*":
                return { type: "", _: left * right };

            default:
                throw new Error(
                    `Unhandled BinaryExpression operator "${node.operator}"`
                );
        }
    },

    InExpression(node, { visit }) {
        const left = /** @type {_} */ (visit(node.left))._;
        const right = /** @type {_} */ (visit(node.right))._;

        let value = false;

        if (Array.isArray(right)) {
            value = right.includes(left);
        } else if (typeof right === "object" && right !== null) {
            value = left in right;
        }

        return { type: "", _: node.not ? !value : value };
    },

    IsExpression(node, { visit, state }) {
        const left = /** @type {_} */ (visit(node.left))._;

        if (node.right.type === "Identifier") {
            let test = false;
            switch (node.right.name) {
                case "empty": {
                    if (Array.isArray(left)) {
                        test = !left.length;
                    } else if (left !== null && typeof left === "object") {
                        test = !Object.keys(left).length;
                    } else {
                        test = !left;
                    }
                    break;
                }

                case "defined": {
                    if (node.left.type !== "Identifier") {
                        throw new Error(
                            `"... is${
                                node.not ? " not" : ""
                            } defined" expressions can only be done on an Identifier or a MemberExpression`
                        );
                    }

                    test =
                        findScopeFrom(node.left.name, state.scope) !==
                        undefined;
                    break;
                }
            }

            if (node.not) test = !test;

            return { type: "", _: test };
        }

        if (node.right.type === "NullLiteral") {
            let test = left === null;
            if (node.not) test = !test;
            return { type: "", _: test };
        }

        throw new Error(`Unhandled kind of "IsExpression"`);
    },

    RangeExpression(node) {
        /**
         * @type {number[]}
         */
        const values = [];
        const count = Math.abs(node.to.value - node.from.value);

        for (let i = 0; i < count; i++) {
            const add = node.step * i;
            values.push(node.from.value + add);
        }

        return { type: "", _: values };
    },

    UnaryExpression(node, { visit }) {
        const argument = /** @type {_} */ (visit(node.argument))._;

        switch (node.operator) {
            case "not":
                return { type: "", _: !argument };

            case "-":
                return { type: "", _: -argument };

            case "+":
                return { type: "", _: +argument };

            default:
                throw new Error(
                    `Unhandled UnaryExpression operator "${node.operator}"`
                );
        }
    },

    MemberExpression(node, { visit, state }) {
        const object = /** @type {_} */ (visit(node.object))._;

        if (node.computed === true) {
            return {
                type: "",
                _: object[/** @type {_} */ (visit(node.property))._],
            };
        }

        return visit(node.property, { ...state, scope: [object] });
    },

    ArrowFunctionExpression(node, { visit, state }) {
        const fn = (/** @type {any[]} */ ...args) => {
            /** @type {any} */
            const scope = {};

            for (let i = 0; i < node.params.length; i++) {
                const param = node.params[i];
                scope[param.name] = args[i];
            }

            return /** @type {_} */ (
                visit(node.body, pushNewScope(state, scope))
            )._;
        };

        return { type: "", _: fn };
    },

    NumericLiteral: (node) => ({ type: "", _: node.value }),
    NullLiteral: (node) => ({ type: "", _: node.value }),
    BooleanLiteral: (node) => ({ type: "", _: node.value }),
    StringLiteral: (node) => ({ type: "", _: node.value }),

    Identifier(node, { state }) {
        return { type: "", _: searchInScope(node.name, state.scope) };
    },

    Text(node) {
        return { type: "", _: node.data };
    },

    HtmlTag(node, { visit, state }) {
        const anchor = /** @type {Comment} */ (state.currentNode);

        $.html(
            anchor,
            () => /** @type {_} */ (visit(node.expression))._,
            false,
            false
        );
    },

    Variable(node, { visit, state }) {
        const expression = node.name;
        const { object, key } = findScopeFromExpression(
            expression,
            visit,
            state,
            (object, key) => {
                const signal = $.source(/** @type {_} */ (visit(node.value))._);

                Object.defineProperty(object, key, {
                    get: () => $.get(signal),
                    set: (value) => $.set(signal, value),
                });
            }
        );

        $.render_effect(() => {
            object[key] = /** @type {_} */ (visit(node.value))._;
        });
    },

    ExpressionTag(node, { visit, state }) {
        const text = /** @type {Element} */ (state.currentNode);

        $.template_effect(() =>
            $.set_text(text, /** @type {_} */ (visit(node.expression))._)
        );
    },

    IfBlock(node, { visit, state }) {
        const anchor = /** @type {Comment} */ (state.currentNode);
        const alternate = node.alternate;

        $.if(
            anchor,
            () => /** @type {_} */ (visit(node.test))._,
            ($$anchor) => {
                const fragment = getRoot(node.consequent);

                visit(node.consequent, pushNewScope(state, {}, fragment));

                // @ts-ignore
                $.append($$anchor, fragment);
            },
            alternate
                ? ($$anchor) => {
                      const fragment = getRoot(alternate);

                      visit(alternate, pushNewScope(state, {}, fragment));

                      // @ts-ignore
                      $.append($$anchor, fragment);
                  }
                : undefined,
            node.elseif
        );
    },

    ForBlock(node, { state, visit }) {
        const anchor = /** @type {Comment} */ (state.currentNode);
        const fallback = node.fallback;

        const key = node.key;

        const array = () => /** @type {_} */ (visit(node.expression))._;

        let flags = EACH_ITEM_REACTIVE | EACH_INDEX_REACTIVE;

        if (key !== null) {
            flags |= EACH_KEYED;
        }

        $.each(
            anchor,
            flags,
            array,
            key === null ? $.index : ($$key, $$index) => $.unwrap($$key),
            ($$anchor, item, $$index) => {
                const fragment = getRoot(node.body);
                const index = () => $.unwrap($$index);

                visit(
                    node.body,
                    pushNewScope(
                        state,
                        {
                            get [node.context.name]() {
                                return $.unwrap(item);
                            },
                            set [node.context.name](/** @type {any} */ value) {
                                $.set(item, value);
                            },
                            loop: {
                                get index() {
                                    return index() + 1;
                                },
                                get index0() {
                                    return index();
                                },
                                get revindex() {
                                    return array().length - index();
                                },
                                get revindex0() {
                                    return array().length - index() - 1;
                                },
                                get first() {
                                    return index() === 0;
                                },
                                get last() {
                                    return index() === array().length - 1;
                                },
                                get length() {
                                    return array().length;
                                },
                                get parent() {
                                    return (
                                        searchInScope("loop", state.scope) ??
                                        null
                                    );
                                },
                            },
                        },
                        fragment
                    )
                );

                // @ts-ignore
                $.append($$anchor, fragment);
            },
            fallback
                ? ($$anchor) => {
                      const fragment = getRoot(fallback);

                      visit(fallback, pushNewScope(state, {}, fragment));

                      // @ts-ignore
                      $.append($$anchor, fragment);
                  }
                : undefined
        );
    },

    Component(node, { state, visit }) {
        const container = /** @type {HTMLElement} */ (state.currentNode);
        const anchor = document.createTextNode("");
        const component = getComponentByKey(node.key.data);

        container.appendChild(anchor);

        if (!component)
            throw new Error(`Component "${node.key.data}" not found`);

        const props = $.proxy({});

        /**
         * @type {import("#ast").BindDirective | undefined}
         */
        let thisAttr;

        node.attributes.forEach((attr) => {
            switch (attr.type) {
                case "Attribute": {
                    if (attr.value === true) {
                        props[attr.name] = true;
                    } else if (
                        attr.value.length === 1 &&
                        attr.value[0].type === "Text"
                    ) {
                        props[attr.name] = attr.value[0].data;
                    } else {
                        $.render_effect(() => {
                            props[attr.name] = computeAttributeValue(
                                attr,
                                visit,
                                state
                            );
                        });
                    }
                    break;
                }

                case "Spread": {
                    $.render_effect(() => {
                        Object.assign(
                            props,
                            /** @type {_} */ (visit(attr.expression))._
                        );
                    });
                    break;
                }

                case "BindDirective": {
                    if (attr.name === "this") {
                        thisAttr = attr;
                    } else {
                        const expression = attr.expression;

                        $.render_effect(() => {
                            props[attr.name] = /** @type {_} */ (
                                visit(expression)
                            )._;
                        });
                        $.render_effect(() => {
                            setInScope(
                                props[attr.name],
                                expression,
                                visit,
                                state
                            );
                        });
                    }

                    break;
                }

                case "OnDirective": {
                    const expression = attr.expression;
                    if (expression) {
                        // @ts-ignore
                        (props.$$events ??= {})[node.name] = (_event) => {
                            visit(expression, pushNewScope(state, { _event }));
                        };
                    } else {
                        (props.$$events ??= {})[node.name] = function (
                            /** @type {any} */ $$args
                        ) {
                            $.bubble_event.call(
                                this,
                                // @ts-ignore
                                ctx.scope.at(1),
                                $$args
                            );
                        };
                    }

                    break;
                }

                default:
                    throw new Error(
                        `"${attr.type}" not handled yet in component`
                    );
            }
        });

        node.fragment.nodes.forEach((child) => {
            if (child.type === "SnippetBlock") {
                if (!state.scope[0][child.expression.name]) {
                    visit(child);
                }

                props[child.expression.name] =
                    state.scope[0][child.expression.name];
            }
        });

        if (node.fragment.nodes.length) {
            props.children = (
                /** @type {Element | Comment | Text} */ $$anchor,
                /** @type {any} */ $$slotProps
            ) => {
                const fragment = getRoot(node.fragment);

                visit(
                    node.fragment,
                    pushNewScope(state, $$slotProps, fragment)
                );

                $.append($$anchor, fragment);
            };
        }

        if (thisAttr) {
            if (!thisAttr.expression)
                throw new Error(
                    "`bind:this` value must be an Identifier or a MemberExpression"
                );

            const ex = thisAttr.expression;

            const _ctx = {
                ...state,
                scope: [state.els],
            };

            $.bind_this(
                component(anchor, props),
                ($$value) => setInScope($$value, ex, visit, _ctx),
                () => /** @type {_} */ (visit(ex, _ctx))._
            );
        } else {
            component(anchor, props);
        }
    },

    RenderTag(node, { state, visit }) {
        const anchor = /** @type {Text} */ (state.currentNode);
        const callee =
            node.expression.type === "FilterExpression"
                ? node.expression.name
                : node.expression.callee;

        $.snippet(
            () => /** @type {_} */ (visit(callee))._,
            anchor,
            ...node.expression.arguments.map((arg) => () => visit(arg))
        );
    },

    SnippetBlock(node, { state, visit }) {
        const scope = state.scope[0];

        // @ts-ignore
        scope[node.expression.name] = ($$anchor, ...args) => {
            const fragment = getRoot(node.body);
            const props = {};

            node.parameters.forEach((param, i) => {
                Object.defineProperty(props, param.name, {
                    get() {
                        return args[i]()._;
                    },
                });
            });

            visit(node.body, pushNewScope(state, props, fragment));

            $.append($$anchor, fragment);
        };
    },

    KeyBlock(node, { state, visit }) {
        const anchor = /** @type {Comment} */ (state.currentNode);

        $.key(
            anchor,
            () => /** @type {_} */ (visit(node.expression))._,
            ($$anchor) => {
                const fragment = getRoot(node.fragment);

                visit(node.fragment, pushNewScope(state, {}, fragment));

                // @ts-ignore
                $.append($$anchor, fragment);
            }
        );
    },

    ZvelteComponent(node, { state, visit }) {
        const anchor = /** @type {Comment} */ (state.currentNode);
        const props = $.proxy({});

        for (const attr of node.attributes) {
            switch (attr.type) {
                case "Attribute": {
                    $.render_effect(() => {
                        props[attr.name] = computeAttributeValue(
                            attr,
                            visit,
                            state
                        );
                    });
                    break;
                }

                case "BindDirective": {
                    const ex = attr.expression;

                    $.render_effect(() => {
                        props[attr.name] = /** @type {_} */ (visit(ex))._;
                    });

                    $.render_effect(() => {
                        setInScope(props[attr.name], ex, visit, state);
                    });
                    break;
                }

                case "Spread": {
                    $.render_effect(() => {
                        Object.assign(
                            props,
                            /** @type {_} */ (visit(attr.expression))._
                        );
                    });
                    break;
                }

                default:
                    throw new Error(
                        `"${attr.type}" attribute not handled yet on "${node.type}"`
                    );
            }
        }

        node.fragment.nodes.forEach((child) => {
            if (child.type === "SnippetBlock") {
                if (!state.scope[0][child.expression.name]) {
                    visit(child);
                }

                props[child.expression.name] =
                    state.scope[0][child.expression.name];
            }
        });

        if (node.fragment.nodes.length) {
            props.children = (
                /** @type {Element | Comment | Text} */ $$anchor,
                /** @type {any} */ $$slotProps
            ) => {
                const fragment = getRoot(node.fragment);

                visit(
                    node.fragment,
                    pushNewScope(state, $$slotProps, fragment)
                );

                $.append($$anchor, fragment);
            };
        }

        $.component(
            anchor,
            () => /** @type {_} */ (visit(node.expression))._,
            // @ts-ignore
            ($$component) => $$component(anchor, props)
        );
    },
};

/**
 * @param {ZvelteNode} node
 * @returns {DocumentFragment}
 */
function getRoot(node) {
    // @ts-ignore
    return node.__root();
}

/**
 * @param {import("../types.js").State} ctx
 * @param {any} [newScope={}]
 */
function pushNewScope(ctx, newScope = {}, currentNode = ctx.currentNode) {
    return { ...ctx, scope: [...ctx.scope, newScope], currentNode };
}

/**
 * @param {import("#ast").Attribute} attr
 * @param {Visit} visit
 * @param {import("../types.js").State} ctx
 */
function computeAttributeValue(attr, visit, ctx) {
    /** @type {any} */
    let value = UNINITIALIZED;

    if (attr.value === true) value = true;
    else
        attr.value.forEach((n) => {
            const r = /** @type {_} */ (
                visit(n.type === "Text" ? n : n.expression, ctx)
            )._;

            if (value === UNINITIALIZED) {
                value = r;
            } else {
                value = `${value}${r}`;
            }
        });

    return value;
}
