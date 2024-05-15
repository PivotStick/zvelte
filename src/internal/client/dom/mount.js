import * as svelte from "svelte";
import { addTemplatesToAST } from "./astToTemplate.js";
import { parse } from "../../../compiler/phases/1-parse/index.js";
import { getFilter } from "../runtime/filters.js";
import { UNINITIALIZED, findScopeFrom, searchInScope } from "../shared.js";
import { getComponentByKey, registerComponent } from "../runtime/components.js";

// @ts-ignore
import * as $ from "svelte/internal/client";

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
    addTemplatesToAST(ast);

    /**
     * @type {Methods}
     */
    let methods;

    const component = (
        /** @type {any} */ $$anchor,
        /** @type {Record<string, any>} */ $$props,
    ) => {
        if (init) $.push($$props, true);

        const fragment = getRoot(ast);
        const scope = initScope?.() ?? {};

        const ctx = {
            scope: [scope, $$props],
            els: {},
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

        if (init) $.pop();
    };

    /**
     * @param {{ target: HTMLElement; props: any; hydrate?: boolean; }} args
     */
    const mount = ({ target, props, hydrate = false }) => {
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
 * @param {import("#ast").Any} node
 * @param {any} currentNode
 * @param {import("../types.js").Ctx} ctx
 * @returns {any}
 */
function handle(node, currentNode, ctx) {
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

                handle(child, currentNode, ctx);
            });
            break;
        }

        case "Element": {
            node.attributes.forEach((attr) => handle(attr, currentNode, ctx));
            handle(node.fragment, currentNode, ctx);
            break;
        }

        case "Attribute": {
            if (
                node.values !== true &&
                (node.values.length > 1 || node.values[0].type !== "Text")
            ) {
                const element = /** @type {HTMLElement} */ (currentNode);

                if (
                    (element instanceof HTMLButtonElement &&
                        node.name === "disabled") ||
                    (element instanceof HTMLInputElement &&
                        (node.name === "value" || node.name === "checked"))
                ) {
                    $.render_effect(() => {
                        // @ts-ignore
                        element[node.name] = computeAttributeValue(
                            node,
                            currentNode,
                            ctx,
                        );
                    });
                } else {
                    $.render_effect(() => {
                        $.set_attribute(
                            element,
                            node.name,
                            computeAttributeValue(node, currentNode, ctx),
                        );
                    });
                }
            }
            break;
        }

        case "BindDirective": {
            const ex = node.expression ?? {
                type: "Identifier",
                name: node.name,
                start: -1,
                end: -1,
            };

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
                        () => handle(ex, currentNode, _ctx),
                    );
                }

                case "group": {
                    const element = /** @type {HTMLInputElement} */ (
                        currentNode
                    );
                    const id = JSON.stringify(node.expression);
                    const bindingGroup = ((ctx.bindingGroups ??= {})[id] ??=
                        []);
                    const groupIndex = [];
                    const loop = searchInScope("loop", ctx.scope);
                    if (loop?.index0 !== undefined) {
                        groupIndex.push(loop.index0);
                    }
                    element.value =
                        // @ts-ignore
                        null == (element.__value = element.value)
                            ? ""
                            : element.value;
                    $.bind_group(
                        bindingGroup,
                        // @ts-ignore
                        groupIndex,
                        element,
                        get,
                        set,
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
                getParams,
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
                    false,
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
            const ex = node.expression ?? {
                type: "Identifier",
                name: node.name,
                start: -1,
                end: -1,
            };

            $.render_effect(() => {
                $.toggle_class(element, name, handle(ex, currentNode, ctx));
            });
            break;
        }

        case "CallExpression": {
            const fn = handle(node.name, currentNode, ctx);
            const args = node.arguments.map((arg) =>
                handle(arg, currentNode, ctx),
            );

            return fn(...args);
        }

        case "FilterExpression": {
            const fn =
                handle(node.name, currentNode, ctx) ??
                getFilter(node.name.name);

            const args = node.arguments.map((arg) =>
                handle(arg, currentNode, ctx),
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

        case "BinaryExpression": {
            const left = handle(node.left, currentNode, ctx);

            switch (node.operator) {
                case "??":
                    return left ?? handle(node.right, currentNode, ctx);
            }

            const right = handle(node.right, currentNode, ctx);

            switch (node.operator) {
                case "~":
                case "+":
                    return left + right;

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

                case "and":
                    return left && right;
                case "||":
                case "or":
                    return left || right;

                default:
                    throw new Error(
                        `Unhandled BinaryExpression operator "${node.operator}"`,
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
                        } else {
                            test = !left;
                        }
                        break;
                    }

                    case "defined": {
                        test = left !== undefined;
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
                        `Unhandled UnaryExpression operator "${node.operator}"`,
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
                false,
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
                        handle(node.value, currentNode, ctx),
                    );

                    Object.defineProperty(object, key, {
                        get: () => $.get(signal),
                        set: (value) => $.set(signal, value),
                    });
                },
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

            $.render_effect(() =>
                $.set_text(
                    text,
                    $.stringify(handle(node.expression, currentNode, ctx)),
                ),
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
                node.elseif,
            );

            break;
        }

        case "ForBlock": {
            const anchor = /** @type {Comment} */ (currentNode);
            const fallback = node.fallback;

            let array;
            $.each(
                anchor,
                65,
                () => (array = handle(node.expression, currentNode, ctx)),
                $.index,
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
                            loop: {
                                get index() {
                                    return index() + 1;
                                },
                                get index0() {
                                    return index();
                                },
                                get revindex() {
                                    return array.length - index();
                                },
                                get revindex0() {
                                    return array.length - index() - 1;
                                },
                                get first() {
                                    return index() === 0;
                                },
                                get last() {
                                    return index() === array.length - 1;
                                },
                                get length() {
                                    return array.length;
                                },
                                get parent() {
                                    return searchInScope("loop", ctx.scope);
                                },
                            },
                        }),
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
                    : undefined,
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

            node.attributes.forEach((attr) => {
                switch (attr.type) {
                    case "Attribute": {
                        if (attr.values === true) {
                            props[attr.name] = true;
                        } else if (
                            attr.values.length === 1 &&
                            attr.values[0].type === "Text"
                        ) {
                            props[attr.name] = attr.values[0].data;
                        } else {
                            $.render_effect(() => {
                                props[attr.name] = computeAttributeValue(
                                    attr,
                                    currentNode,
                                    ctx,
                                );
                            });
                        }
                        break;
                    }

                    case "BindDirective": {
                        const expression = attr.expression ?? {
                            type: "Identifier",
                            name: attr.name,
                            start: -1,
                            end: -1,
                        };

                        $.render_effect(() => {
                            props[attr.name] = handle(
                                expression,
                                currentNode,
                                ctx,
                            );
                        });
                        $.render_effect(() => {
                            setInScope(
                                props[attr.name],
                                expression,
                                currentNode,
                                ctx,
                            );
                        });
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
                                    pushNewScope(ctx, { _event }),
                                );
                            };
                        } else {
                            (props.$$events ??= {})[node.name] = function (
                                /** @type {any} */ $$args,
                            ) {
                                $.bubble_event.call(
                                    this,
                                    // @ts-ignore
                                    ctx.scope.at(1),
                                    $$args,
                                );
                            };
                        }

                        break;
                    }

                    default:
                        break;
                }
            });

            if (node.fragment.nodes.length) {
                props.children = (
                    /** @type {Element | Comment | Text} */ $$anchor,
                    /** @type {any} */ $$slotProps,
                ) => {
                    const fragment = getRoot(node.fragment);

                    handle(
                        node.fragment,
                        fragment,
                        pushNewScope(ctx, $$slotProps),
                    );

                    $.append($$anchor, fragment);
                };
            }

            component(anchor, props);
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
                                ctx,
                            );
                        });
                        break;
                    }

                    default:
                        throw new Error(
                            `"${attr.type}" attribute not handled yet on "${node.type}"`,
                        );
                }
            }

            if (node.fragment.nodes.length) {
                props.children = (
                    /** @type {Element | Comment | Text} */ $$anchor,
                    /** @type {any} */ $$slotProps,
                ) => {
                    const fragment = getRoot(node.fragment);

                    handle(
                        node.fragment,
                        fragment,
                        pushNewScope(ctx, $$slotProps),
                    );

                    $.append($$anchor, fragment);
                };
            }

            $.component(
                anchor,
                () => handle(node.expression, currentNode, ctx),
                ($$component) => $$component(anchor, props),
            );
            break;
        }

        case "SlotElement": {
            const anchor = /** @type {Comment} */ (currentNode);

            let render = searchInScope("children", ctx.scope);

            if (!render && node.fragment.nodes.length) {
                // @ts-ignore
                render = ($$anchor, $$slotProps) => {
                    const fragment = getRoot(node.fragment);

                    handle(
                        node.fragment,
                        fragment,
                        pushNewScope(ctx, $$slotProps),
                    );

                    $.append($$anchor, fragment);
                };
            }

            /**
             * @type {Record<string, any>}
             */
            const props = $.proxy({});

            node.attributes.forEach((attr) => {
                $.render_effect(() => {
                    props[attr.name] = computeAttributeValue(
                        attr,
                        currentNode,
                        ctx,
                    );
                });
            });

            render?.(anchor, props);
            break;
        }

        default:
            throw new Error(`"${node.type}" not handled`);
    }
}

/**
 * @param {import("#ast").Any} node
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

    if (attr.values === true) value = true;
    else
        attr.values.forEach((n) => {
            const r = handle(n, currentNode, ctx);

            if (value === UNINITIALIZED) {
                value = r;
            } else {
                value = `${value}${r}`;
            }
        });

    return value;
}
