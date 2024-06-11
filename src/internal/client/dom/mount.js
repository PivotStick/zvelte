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
    const preserveComments = true;
    const preserveWhitespace = false;

    // trim texts on all fragments
    walk(
        /** @type {import("#ast").ZvelteNode} */ (ast),
        {},
        {
            Fragment(node, { path }) {
                const { trimmed } = cleanNodes(
                    path[path.length - 1],
                    node.nodes,
                    path,
                    "",
                    preserveWhitespace,
                    preserveComments,
                    false
                );

                // @ts-ignore
                node.nodes = trimmed;
            },
        }
    );

    addTemplatesToAST(ast);

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

        const ctx = {
            scope: [scope, $$props],
            els: {},
            bindingGroups: {},
        };

        if (init) {
            methods = init({
                props: $$props,
                els: ctx.els,
                scope,
            });
        }

        handle(ast, fragment, ctx);

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
 * @param {Node} currentNode
 * @param {import("../types.js").Ctx} ctx
 */
function setInScope(value, expression, currentNode, ctx) {
    let { object, key } = findScopeFromExpression(expression, currentNode, ctx);

    object[key] = value;
}

/**
 * @param {import("#ast").Identifier | import("#ast").MemberExpression} expression
 * @param {Node} currentNode
 * @param {import("../types.js").Ctx} ctx
 * @param {((object: any, key: string) => void)=} onfallback
 */
function findScopeFromExpression(expression, currentNode, ctx, onfallback) {
    let object;
    let key;

    if (expression.type === "MemberExpression") {
        object = handle(expression.object, currentNode, ctx) ?? UNINITIALIZED;
        if (expression.computed === true) {
            key = handle(expression.property, currentNode, ctx);
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
 * @param {import("#ast").ZvelteNode} node
 * @param {any} currentNode
 * @param {import("../types.js").Ctx} ctx
 * @param {import("#ast").ZvelteNode | null} parent
 * @returns {any}
 */
function handle(node, currentNode, ctx, parent = null) {
    switch (node.type) {
        case "Root":
            handle(node.fragment, currentNode, ctx);
            break;

        case "Fragment": {
            node.nodes.forEach((child, i) => {
                const isText = child.type === "Text";

                currentNode =
                    i === 0
                        ? $.first_child(currentNode, isText)
                        : $.sibling(currentNode, isText);

                currentNode.replace = (/** @type {any} */ node) =>
                    (currentNode = node);

                handle(child, currentNode, ctx);
            });
            break;
        }

        case "RegularElement": {
            node.attributes.forEach((attr) => {
                handle(attr, currentNode, ctx, node);
            });
            handle(node.fragment, currentNode, ctx);
            break;
        }

        case "Attribute": {
            if (
                node.value !== true &&
                (node.value.length > 1 || node.value[0].type !== "Text")
            ) {
                const element = /** @type {HTMLElement} */ (currentNode);

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
                            currentNode,
                            ctx
                        );
                    });
                } else {
                    $.render_effect(() => {
                        $.set_attribute(
                            element,
                            node.name,
                            computeAttributeValue(node, currentNode, ctx)
                        );
                    });
                }
            }
            break;
        }

        case "BindDirective": {
            const ex = node.expression;

            const get = () => handle(ex, currentNode, ctx);
            const set = (/** @type {any} */ $$value) =>
                setInScope($$value, ex, currentNode, ctx);

            switch (node.name) {
                case "value": {
                    const element = /** @type {HTMLInputElement} */ (
                        currentNode
                    );
                    $.bind_value(element, get, set);
                    break;
                }

                case "checked": {
                    const element = /** @type {HTMLInputElement} */ (
                        currentNode
                    );
                    $.bind_checked(element, get, set);
                    break;
                }

                case "this": {
                    const element = /** @type {HTMLElement} */ (currentNode);
                    const _ctx = {
                        ...ctx,
                        scope: [ctx.els],
                    };
                    $.bind_this(
                        element,
                        ($$value) => setInScope($$value, ex, currentNode, _ctx),
                        () => handle(ex, currentNode, _ctx)
                    );
                }

                case "group": {
                    const element = /** @type {HTMLInputElement} */ (
                        currentNode
                    );
                    const id = JSON.stringify(node.expression);
                    const bindingGroup = (ctx.bindingGroups[id] ??= []);
                    const groupIndex = [];
                    const loop = searchInScope("loop", ctx.scope);
                    if (loop?.parent) {
                        groupIndex.push(loop.parent.index0);
                    }

                    $.remove_input_attr_defaults(element);

                    const valueAttribute =
                        parent?.type === "RegularElement" &&
                        parent.attributes.find(
                            (attr) =>
                                attr.type === "Attribute" &&
                                attr.name === "value"
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
                            computeAttributeValue(
                                valueAttribute,
                                currentNode,
                                ctx
                            ));

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
            break;
        }

        case "TransitionDirective": {
            const element = /** @type {HTMLElement} */ (currentNode);
            const args = node.expression;

            const INTRO = 1;
            const OUTRO = 2;
            const BOTH = 3;
            const GLOBAL = 4;

            let getParams = null;
            let flag =
                node.intro && node.outro ? BOTH : node.intro ? INTRO : OUTRO;

            if (args) {
                getParams = () => handle(args, currentNode, ctx);
            }

            if (node.modifiers.includes("global")) {
                flag += GLOBAL;
            }

            $.transition(
                flag,
                element,
                () => searchInScope(node.name, ctx.scope),
                getParams
            );

            break;
        }

        case "OnDirective": {
            const element = /** @type {HTMLElement} */ (currentNode);
            const ex = node.expression;

            if (ex) {
                $.event(
                    node.name,
                    element,
                    (_event) => {
                        handle(ex, currentNode, pushNewScope(ctx, { _event }));
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
            break;
        }

        case "ClassDirective": {
            const element = /** @type {HTMLElement} */ (currentNode);
            const name = node.name;
            const ex = node.expression;

            $.render_effect(() => {
                $.toggle_class(element, name, handle(ex, currentNode, ctx));
            });
            break;
        }

        case "CallExpression": {
            const fn = handle(node.callee, currentNode, ctx);
            const args = node.arguments.map((arg) =>
                handle(arg, currentNode, ctx)
            );

            return fn(...args);
        }

        case "FilterExpression": {
            const fn =
                handle(node.name, currentNode, ctx) ??
                getFilter(node.name.name);

            const args = node.arguments.map((arg) =>
                handle(arg, currentNode, ctx)
            );

            return fn(...args);
        }

        case "ConditionalExpression": {
            const test = handle(node.test, currentNode, ctx);

            return test
                ? handle(node.consequent, currentNode, ctx)
                : handle(node.alternate, currentNode, ctx);
        }

        case "ObjectExpression": {
            /** @type {any} */
            const object = {};
            node.properties.forEach((property) => {
                object[
                    property.key.type === "StringLiteral"
                        ? property.key.value
                        : property.key.name
                ] = handle(property.value, currentNode, ctx);
            });
            return object;
        }

        case "ArrayExpression": {
            /** @type {any[]} */
            const array = [];
            node.elements.forEach((element) => {
                array.push(handle(element, currentNode, ctx));
            });
            return array;
        }

        case "LogicalExpression": {
            const left = handle(node.left, currentNode, ctx);
            const right = () => handle(node.right, currentNode, ctx);

            switch (node.operator) {
                case "??":
                    return left ?? right();
                case "and":
                    return left && right();
                case "||":
                case "or":
                    return left || right();

                default:
                    throw new Error(
                        // @ts-expect-error
                        `Unhandled LogicalExpression operator "${node.operator}"`
                    );
            }
        }
        case "BinaryExpression": {
            const left = handle(node.left, currentNode, ctx);
            const right = handle(node.right, currentNode, ctx);

            switch (node.operator) {
                case "~":
                    return String(left) + String(right);

                case "+":
                    return Number(left) + Number(right);

                case "-":
                    return left - right;

                case "==":
                    return left == right;
                case "!=":
                    return left != right;

                case ">=":
                    return left >= right;
                case "<=":
                    return left <= right;

                case ">":
                    return left > right;
                case "<":
                    return left < right;

                case "/":
                    return left / right;
                case "*":
                    return left * right;

                default:
                    throw new Error(
                        // @ts-expect-error
                        `Unhandled BinaryExpression operator "${node.operator}"`
                    );
            }
        }

        case "InExpression": {
            const left = handle(node.left, currentNode, ctx);
            const right = handle(node.right, currentNode, ctx);
            let value = false;

            if (Array.isArray(right)) {
                value = right.includes(left);
            } else if (typeof right === "object" && right !== null) {
                value = left in right;
            }

            return node.not ? !value : value;
        }

        case "IsExpression": {
            const left = handle(node.left, currentNode, ctx);

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
                            findScopeFrom(node.left.name, ctx.scope) !==
                            undefined;
                        break;
                    }
                }

                if (node.not) test = !test;

                return test;
            }

            if (node.right.type === "NullLiteral") {
                let test = left === null;
                if (node.not) test = !test;
                return test;
            }

            throw new Error(`Unhandled kind of "IsExpression"`);
        }

        case "RangeExpression": {
            /**
             * @type {number[]}
             */
            const values = [];
            const count = Math.abs(node.to.value - node.from.value);

            for (let i = 0; i < count; i++) {
                const add = node.step * i;
                values.push(node.from.value + add);
            }

            return values;
        }

        case "UnaryExpression": {
            const argument = handle(node.argument, currentNode, ctx);

            switch (node.operator) {
                case "not":
                    return !argument;

                case "-":
                    return -argument;

                case "+":
                    return +argument;

                default:
                    throw new Error(
                        // @ts-expect-error
                        `Unhandled UnaryExpression operator "${node.operator}"`
                    );
            }
        }

        case "MemberExpression": {
            const object = handle(node.object, currentNode, ctx);

            if (node.computed === true) {
                return object[handle(node.property, currentNode, ctx)];
            }

            return handle(node.property, currentNode, {
                ...ctx,
                scope: [object],
            });
        }

        case "ArrowFunctionExpression": {
            return (/** @type {any[]} */ ...args) => {
                /** @type {any} */
                const scope = {};

                for (let i = 0; i < node.params.length; i++) {
                    const param = node.params[i];
                    scope[param.name] = args[i];
                }

                return handle(node.body, currentNode, pushNewScope(ctx, scope));
            };
        }

        case "NumericLiteral":
        case "NullLiteral":
        case "BooleanLiteral":
        case "StringLiteral": {
            return node.value;
        }

        case "Identifier": {
            return searchInScope(node.name, ctx.scope);
        }

        case "Text": {
            return node.data;
        }

        case "HtmlTag": {
            const anchor = /** @type {Comment} */ (currentNode);
            $.html(
                anchor,
                () => handle(node.expression, currentNode, ctx),
                false,
                false
            );
            break;
        }

        case "Comment":
            break;

        case "Variable": {
            const expression = node.name;
            const { object, key } = findScopeFromExpression(
                expression,
                currentNode,
                ctx,
                (object, key) => {
                    const signal = $.source(
                        handle(node.value, currentNode, ctx)
                    );

                    Object.defineProperty(object, key, {
                        get: () => $.get(signal),
                        set: (value) => $.set(signal, value),
                    });
                }
            );

            $.render_effect(() => {
                object[key] = handle(node.value, currentNode, ctx);
            });
            break;
        }

        case "ExpressionTag": {
            const anchor = /** @type {Comment} */ (currentNode);
            const text = $.text(anchor);
            anchor.before(text);
            anchor.remove();
            currentNode.replace(text);

            $.template_effect(() =>
                $.set_text(
                    text,
                    $.stringify(handle(node.expression, currentNode, ctx))
                )
            );
            break;
        }

        case "IfBlock": {
            const anchor = /** @type {Comment} */ (currentNode);
            const alternate = node.alternate;

            $.if(
                anchor,
                () => handle(node.test, currentNode, ctx),
                ($$anchor) => {
                    const fragment = getRoot(node.consequent);

                    handle(node.consequent, fragment, pushNewScope(ctx, {}));

                    // @ts-ignore
                    $.append($$anchor, fragment);
                },
                alternate
                    ? ($$anchor) => {
                          const fragment = getRoot(alternate);

                          handle(alternate, fragment, pushNewScope(ctx, {}));

                          // @ts-ignore
                          $.append($$anchor, fragment);
                      }
                    : undefined,
                node.elseif
            );

            break;
        }

        case "ForBlock": {
            const anchor = /** @type {Comment} */ (currentNode);
            const fallback = node.fallback;

            const key = node.key;

            const array = () => handle(node.expression, currentNode, ctx);

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

                    handle(
                        node.body,
                        fragment,
                        pushNewScope(ctx, {
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
                                    return searchInScope("loop", ctx.scope);
                                },
                            },
                        })
                    );

                    // @ts-ignore
                    $.append($$anchor, fragment);
                },
                fallback
                    ? ($$anchor) => {
                          const fragment = getRoot(fallback);

                          handle(fallback, fragment, pushNewScope(ctx, {}));

                          // @ts-ignore
                          $.append($$anchor, fragment);
                      }
                    : undefined
            );

            break;
        }

        case "Component": {
            const container = /** @type {HTMLElement} */ (currentNode);
            currentNode = $.first_child(currentNode, false);
            const anchor = /** @type {Comment} */ (currentNode);
            const component = getComponentByKey(node.key.data);

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
                                    currentNode,
                                    ctx
                                );
                            });
                        }
                        break;
                    }

                    case "Spread": {
                        $.render_effect(() => {
                            Object.assign(
                                props,
                                handle(attr.expression, currentNode, ctx)
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
                                props[attr.name] = handle(
                                    expression,
                                    currentNode,
                                    ctx
                                );
                            });
                            $.render_effect(() => {
                                setInScope(
                                    props[attr.name],
                                    expression,
                                    currentNode,
                                    ctx
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
                                handle(
                                    expression,
                                    currentNode,
                                    pushNewScope(ctx, { _event })
                                );
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
                    if (!ctx.scope[0][child.expression.name]) {
                        handle(child, currentNode, ctx);
                    }

                    props[child.expression.name] =
                        ctx.scope[0][child.expression.name];
                }
            });

            if (node.fragment.nodes.length) {
                props.children = (
                    /** @type {Element | Comment | Text} */ $$anchor,
                    /** @type {any} */ $$slotProps
                ) => {
                    const fragment = getRoot(node.fragment);

                    handle(
                        node.fragment,
                        fragment,
                        pushNewScope(ctx, $$slotProps)
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
                    ...ctx,
                    scope: [ctx.els],
                };
                $.bind_this(
                    component(anchor, props),
                    ($$value) => setInScope($$value, ex, currentNode, _ctx),
                    () => handle(ex, currentNode, _ctx)
                );
            } else {
                component(anchor, props);
            }
            break;
        }

        case "RenderTag": {
            const anchor = /** @type {Comment} */ (currentNode);
            const callee =
                node.expression.type === "FilterExpression"
                    ? node.expression.name
                    : node.expression.callee;

            $.snippet(() => handle(callee, currentNode, ctx), anchor);
            break;
        }

        case "SnippetBlock": {
            const anchor = /** @type {Comment} */ (currentNode);
            const empty = document.createTextNode("");

            anchor.replaceWith(empty);
            anchor.remove();
            currentNode.replace(empty);

            const scope = ctx.scope[0];

            // @ts-ignore
            scope[node.expression.name] = ($$anchor, ...args) => {
                const fragment = getRoot(node.body);
                const props = $.proxy({});

                node.parameters.forEach((param, i) => {
                    props[param.name] = args[i];
                });

                handle(node.body, fragment, pushNewScope(ctx, props));

                $.append($$anchor, fragment);
            };
            break;
        }

        case "KeyBlock": {
            const anchor = /** @type {Comment} */ (currentNode);

            $.key(
                anchor,
                () => handle(node.expression, currentNode, ctx),
                ($$anchor) => {
                    const fragment = getRoot(node.fragment);

                    handle(node.fragment, fragment, ctx);

                    // @ts-ignore
                    $.append($$anchor, fragment);
                }
            );

            break;
        }

        case "ZvelteComponent": {
            const anchor = /** @type {Comment} */ (currentNode);
            const props = $.proxy({});

            for (const attr of node.attributes) {
                switch (attr.type) {
                    case "Attribute": {
                        $.render_effect(() => {
                            props[attr.name] = computeAttributeValue(
                                attr,
                                currentNode,
                                ctx
                            );
                        });
                        break;
                    }

                    case "BindDirective": {
                        const ex = attr.expression;

                        $.render_effect(() => {
                            props[attr.name] = handle(ex, currentNode, ctx);
                        });

                        $.render_effect(() => {
                            setInScope(props[attr.name], ex, currentNode, ctx);
                        });
                        break;
                    }

                    case "Spread": {
                        $.render_effect(() => {
                            Object.assign(
                                props,
                                handle(attr.expression, currentNode, ctx)
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
                    if (!ctx.scope[0][child.expression.name]) {
                        handle(child, currentNode, ctx);
                    }

                    props[child.expression.name] =
                        ctx.scope[0][child.expression.name];
                }
            });

            if (node.fragment.nodes.length) {
                props.children = (
                    /** @type {Element | Comment | Text} */ $$anchor,
                    /** @type {any} */ $$slotProps
                ) => {
                    const fragment = getRoot(node.fragment);

                    handle(
                        node.fragment,
                        fragment,
                        pushNewScope(ctx, $$slotProps)
                    );

                    $.append($$anchor, fragment);
                };
            }

            $.component(
                anchor,
                () => handle(node.expression, currentNode, ctx),
                ($$component) => $$component(anchor, props)
            );
            break;
        }

        default:
            throw new Error(`"${node.type}" not handled`);
    }
}

/**
 * @param {import("#ast").ZvelteNode} node
 * @returns {DocumentFragment}
 */
function getRoot(node) {
    // @ts-ignore
    return node.__root();
}

/**
 * @param {import("../types.js").Ctx} ctx
 * @param {any} [newScope={}]
 */
function pushNewScope(ctx, newScope = {}) {
    return { ...ctx, scope: [...ctx.scope, newScope] };
}

/**
 * @param {import("#ast").Attribute} attr
 * @param {any} currentNode
 * @param {import("../types.js").Ctx} ctx
 */
function computeAttributeValue(attr, currentNode, ctx) {
    /** @type {any} */
    let value = UNINITIALIZED;

    if (attr.value === true) value = true;
    else
        attr.value.forEach((n) => {
            const r = handle(
                n.type === "Text" ? n : n.expression,
                currentNode,
                ctx
            );

            if (value === UNINITIALIZED) {
                value = r;
            } else {
                value = `${value}${r}`;
            }
        });

    return value;
}
