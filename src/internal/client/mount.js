import * as $ from "svelte/internal/client";
import { mount as svelte, unmount } from "svelte";
import { addTemplatesToAST } from "./astToTemplate.js";
import { parse } from "../../compiler/parse/index.js";
import { getFilter } from "./filters.js";
import { findScopeFrom, searchInScope } from "./shared.js";

/**
 * @todo
 *
 * - handle "Variable", make sure they set the var in the current scope if not found in the whole scope
 */

/**
 * @type {import("./types.js").Ctx=}
 */
let currentCtx;

/**
 * @template Props
 * @template Methods
 * @param {{
 *   target: HTMLElement;
 *   scope?: Record<string, any>;
 *   props?: Props;
 *   source?: string;
 *   init?: (args: import("./types.js").ComponentInitArgs<Props>) => Methods;
 * }} args
 */
export function mount({
    target,
    scope: rootScope = {},
    source = "",
    // @ts-expect-error
    props = {},
    init,
}) {
    props = $.proxy(props);

    const ast = parse(source);
    addTemplatesToAST(ast);

    /**
     * @type {Methods}
     */
    let methods;

    // @ts-ignore
    const component = ($$anchor, $$props) => {
        if (init) $.push($$props, true);
        const fragment = getRoot(ast);

        const previousCtx = currentCtx;
        currentCtx = {
            scope: [rootScope, $$props],
            els: {},
        };

        if (init) {
            methods = init({
                props: $$props,
                els: currentCtx.els,
                scope: rootScope,
            });
        }

        handle(ast, document.createTreeWalker(fragment), currentCtx);

        $.append($$anchor, fragment);
        if (init) $.pop();
        currentCtx = previousCtx;
    };

    // @ts-ignore
    const instance = svelte(component, { target, props });

    return {
        // @ts-ignore
        methods,
        destroy() {
            unmount(instance);
        },
    };
}

/**
 * @param {*} value
 * @param {import("../../compiler/parse/types.js").Identifier | import("../../compiler/parse/types.js").MemberExpression} expression
 * @param {TreeWalker} walker
 * @param {import("./types.js").Ctx} ctx
 */
function setInScope(value, expression, walker, ctx) {
    let object;
    let key;
    if (expression.type === "MemberExpression") {
        object = handle(expression.object, walker, ctx);
        if (expression.computed === true) {
            key = handle(expression.property, walker, ctx);
        } else {
            key = expression.property.name;
        }
    } else {
        object = findScopeFrom(expression.name, ctx.scope) ?? ctx.scope[0];
        key = expression.name;
    }

    object[key] = value;
}

/**
 * @param {import("../../compiler/parse/types.js").Any} node
 * @param {TreeWalker} walker
 * @param {import("./types.js").Ctx} ctx
 * @returns {any}
 */
function handle(node, walker, ctx) {
    switch (node.type) {
        case "Root":
            handle(node.fragment, walker, ctx);
            break;

        case "Fragment": {
            node.nodes.forEach((child) => {
                walker.nextNode();
                handle(child, walker, ctx);
            });
            break;
        }

        case "Element": {
            node.attributes.forEach((attr) => handle(attr, walker, ctx));
            handle(node.fragment, walker, ctx);
            break;
        }

        case "Attribute": {
            if (
                node.value !== true &&
                (node.value.length > 1 || node.value[0].type !== "Text")
            ) {
                const element = /** @type {HTMLElement} */ (walker.currentNode);
                const values = node.value;
                const UNINITIALIZED = Symbol();
                const computeValue = () => {
                    /** @type {any} */
                    let value = UNINITIALIZED;

                    values.forEach((n) => {
                        const r = handle(n, walker, ctx);

                        if (value === UNINITIALIZED) {
                            value = r;
                        } else {
                            value = `${value}${r}`;
                        }
                    });

                    return value;
                };

                if (
                    (element instanceof HTMLButtonElement &&
                        node.name === "disabled") ||
                    (element instanceof HTMLInputElement &&
                        (node.name === "value" || node.name === "checked"))
                ) {
                    $.render_effect(() => {
                        // @ts-ignore
                        element[node.name] = computeValue();
                    });
                } else {
                    $.render_effect(() => {
                        $.set_attribute(element, node.name, computeValue());
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

            const get = () => handle(ex, walker, ctx);
            const set = (/** @type {any} */ $$value) =>
                setInScope($$value, ex, walker, ctx);

            switch (node.name) {
                case "value": {
                    const element = /** @type {HTMLInputElement} */ (
                        walker.currentNode
                    );
                    $.bind_value(element, get, set);
                    break;
                }

                case "checked": {
                    const element = /** @type {HTMLInputElement} */ (
                        walker.currentNode
                    );
                    $.bind_checked(element, get, set);
                    break;
                }

                case "this": {
                    const element = /** @type {HTMLElement} */ (
                        walker.currentNode
                    );
                    const _ctx = {
                        ...ctx,
                        scope: [ctx.els],
                    };
                    $.bind_this(
                        element,
                        ($$value) => setInScope($$value, ex, walker, _ctx),
                        () => handle(ex, walker, _ctx),
                    );
                }

                case "group": {
                    const element = /** @type {HTMLInputElement} */ (
                        walker.currentNode
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
            const element = /** @type {HTMLElement} */ (walker.currentNode);
            const args = node.expression;

            const INTRO = 1;
            const OUTRO = 2;
            const BOTH = 3;

            let getParams = null;
            let flag =
                node.intro && node.outro ? BOTH : node.intro ? INTRO : OUTRO;

            if (args) {
                getParams = () => handle(args, walker, ctx);
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
            const element = /** @type {HTMLElement} */ (walker.currentNode);
            const ex = node.expression;

            if (ex) {
                $.event(
                    node.name,
                    element,
                    (_event) => {
                        handle(ex, walker, pushNewScope(ctx, { _event }));
                    },
                    false,
                );
            } else {
                // @todo
                // handle automatic component emitting this event
            }
            break;
        }

        case "ClassDirective": {
            const element = /** @type {HTMLElement} */ (walker.currentNode);
            const name = node.name;
            const ex = node.expression ?? {
                type: "Identifier",
                name: node.name,
                start: -1,
                end: -1,
            };

            $.render_effect(() => {
                $.toggle_class(element, name, handle(ex, walker, ctx));
            });
            break;
        }

        case "CallExpression": {
            const fn = handle(node.name, walker, ctx);
            const args = node.arguments.map((arg) => handle(arg, walker, ctx));

            return fn(...args);
        }

        case "FilterExpression": {
            const fn =
                handle(node.name, walker, ctx) ?? getFilter(node.name.name);

            const args = node.arguments.map((arg) => handle(arg, walker, ctx));

            return fn(...args);
        }

        case "ConditionalExpression": {
            const test = handle(node.test, walker, ctx);

            return test
                ? handle(node.consequent, walker, ctx)
                : handle(node.alternate, walker, ctx);
        }

        case "ObjectExpression": {
            /** @type {any} */
            const object = {};
            node.properties.forEach((property) => {
                object[
                    property.key.type === "StringLiteral"
                        ? property.key.value
                        : property.key.name
                ] = handle(property.value, walker, ctx);
            });
            return object;
        }

        case "ArrayExpression": {
            /** @type {any[]} */
            const array = [];
            node.elements.forEach((element) => {
                array.push(handle(element, walker, ctx));
            });
            return array;
        }

        case "BinaryExpression": {
            const left = handle(node.left, walker, ctx);

            switch (node.operator) {
                case "??":
                    return left ?? handle(node.right, walker, ctx);
            }

            const right = handle(node.right, walker, ctx);

            switch (node.operator) {
                case "in":
                    if (Array.isArray(right)) {
                        return right.includes(left);
                    } else if (typeof right === "object" && right !== null) {
                        return left in right;
                    }

                    return false;

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

        case "UnaryExpression": {
            const argument = handle(node.argument, walker, ctx);

            switch (node.operator) {
                case "not":
                    return !argument;

                case "-":
                    return -argument;

                default:
                    throw new Error(
                        // @ts-expect-error
                        `Unhandled UnaryExpression operator "${node.operator}"`,
                    );
            }
        }

        case "MemberExpression": {
            const object = handle(node.object, walker, ctx);

            if (node.computed === true) {
                return object[handle(node.property, walker, ctx)];
            }

            return handle(node.property, walker, { ...ctx, scope: [object] });
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
            const anchor = /** @type {Comment} */ (walker.currentNode);
            $.html(
                anchor,
                () => handle(node.expression, walker, ctx),
                false,
                false,
            );
            break;
        }

        case "ExpressionTag": {
            const anchor = /** @type {Comment} */ (walker.currentNode);
            const text = $.text(anchor);
            anchor.replaceWith(text);
            walker.currentNode = text;

            $.render_effect(() =>
                $.set_text(
                    text,
                    $.stringify(handle(node.expression, walker, ctx)),
                ),
            );
            break;
        }

        case "IfBlock": {
            const anchor = /** @type {Comment} */ (walker.currentNode);
            const alternate = node.alternate;

            $.if(
                anchor,
                () => handle(node.test, walker, ctx),
                ($$anchor) => {
                    const fragment = getRoot(node.consequent);

                    handle(
                        node.consequent,
                        document.createTreeWalker(fragment),
                        pushNewScope(ctx, {}),
                    );

                    // @ts-ignore
                    $.append($$anchor, fragment);
                },
                alternate
                    ? ($$anchor) => {
                          const fragment = getRoot(alternate);

                          handle(
                              alternate,
                              document.createTreeWalker(fragment),
                              pushNewScope(ctx, {}),
                          );

                          // @ts-ignore
                          $.append($$anchor, fragment);
                      }
                    : undefined,
                node.elseif,
            );

            break;
        }

        case "ForBlock": {
            const anchor = /** @type {Comment} */ (walker.currentNode);
            const fallback = node.fallback;

            let array;
            $.each(
                anchor,
                65,
                () => (array = handle(node.expression, walker, ctx)),
                $.index,
                ($$anchor, item, $$index) => {
                    const fragment = getRoot(node.body);
                    const index = () => $.unwrap($$index);

                    handle(
                        node.body,
                        document.createTreeWalker(fragment),
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

                          handle(
                              fallback,
                              document.createTreeWalker(fragment),
                              pushNewScope(ctx, {}),
                          );

                          // @ts-ignore
                          $.append($$anchor, fragment);
                      }
                    : undefined,
            );

            break;
        }

        default:
            throw new Error(`"${node.type}" not handled`);
    }
}

/**
 * @param {import("../../compiler/parse/types.js").Any} node
 * @returns {DocumentFragment}
 */
function getRoot(node) {
    // @ts-ignore
    return node.__root();
}

/**
 * @param {import("./types.js").Ctx} ctx
 * @param {any} [newScope={}]
 */
function pushNewScope(ctx, newScope = {}) {
    return { ...ctx, scope: [...ctx.scope, newScope] };
}
