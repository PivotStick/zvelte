// @ts-ignore
import * as $ from "svelte/internal/client";
import { mount as svelte, unmount } from "svelte";
import { addTemplatesToAST } from "./astToTemplate";
import { parse } from "../../compiler/parse";
import { getFilter } from "./filters";
import { findScopeFrom, searchInScope } from "./shared";

/**
 * @typedef {{
 *   scope: Record<string, any>[];
 *   listeners: Record<string, (...args: any[]) => void>;
 *   els: Record<string, HTMLElement>;
 * }} Ctx
 */

/**
 * @type {Ctx=}
 */
let currentCtx;

/**
 * @param {Ctx["listeners"]} listeners
 */
export function setListeners(listeners) {
    if (currentCtx) {
        Object.assign(currentCtx.listeners, listeners);
    }
}

/**
 * @template T
 * @param {{
 *   target: HTMLElement;
 *   props?: T;
 *   source?: string;
 *   init?: (args: { props: T; els: Ctx["els"] }) => any;
 * }} args
 */
export function mount({
    target,
    source = "",
    // @ts-expect-error
    props = {},
    init,
}) {
    props = $.proxy(props);

    const ast = parse(source);
    addTemplatesToAST(ast);

    const component = ($$anchor, $$props) => {
        if (init) $.push($$props, true);
        const fragment = getRoot(ast);

        currentCtx = {
            scope: [$$props],
            listeners: {},
            els: {},
        };

        init?.({
            props: $$props,
            els: currentCtx.els,
        });

        handle(ast, document.createTreeWalker(fragment), currentCtx);

        $.append($$anchor, fragment);
        if (init) $.pop();
        currentCtx = undefined;
    };

    // @ts-ignore
    const instance = svelte(component, { target, props });

    return {
        destroy() {
            unmount(instance);
        },
    };
}

/**
 * @param {*} value
 * @param {import("../../compiler/parse/types").Identifier | import("../../compiler/parse/types").MemberExpression} expression
 * @param {TreeWalker} walker
 * @param {Ctx} ctx
 */
function setInScope(value, expression, walker, ctx) {
    let object;
    let key;
    if (expression.type === "MemberExpression") {
        object = [handle(expression.object, walker, ctx)];
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
 * @param {import("../../compiler/parse/types").Any} node
 * @param {TreeWalker} walker
 * @param {Ctx} ctx
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
                $.render_effect(() => {
                    let value = "";
                    values.forEach((n) => (value += handle(n, walker, ctx)));
                    $.set_attribute(element, node.name, value);
                });
            }
            break;
        }

        case "BindDirective": {
            const element = /** @type {HTMLElement} */ (walker.currentNode);
            const get = () => handle(node.expression, walker, ctx);
            const set = ($$value) =>
                setInScope($$value, node.expression, walker, ctx);

            switch (node.name) {
                case "value":
                    $.bind_value(element, get, set);
                    break;

                case "checked":
                    $.bind_checked(element, get, set);
                    break;
                case "this":
                    const _ctx = {
                        ...ctx,
                        scope: [ctx.els],
                    };
                    $.bind_this(
                        element,
                        ($$value) =>
                            setInScope($$value, node.expression, walker, _ctx),
                        () => handle(node.expression, walker, _ctx),
                    );
                default:
                    break;
            }
            break;
        }

        case "OnDirective": {
            const element = /** @type {HTMLElement} */ (walker.currentNode);

            $.event(
                node.name,
                element,
                (_event) => {
                    handle(
                        node.expression,
                        walker,
                        pushNewScope(ctx, { ...ctx.listeners, _event }),
                    );
                },
                false,
            );
            break;
        }

        case "FilterExpression": {
            const args = [];

            node.arguments.forEach((arg) => {
                args.push(handle(arg, walker, ctx));
            });

            const fn =
                handle(node.name, walker, ctx) ?? getFilter(node.name.name);

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
            const text = $.text("");
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

                    $.append($$anchor, fragment);
                },
                node.alternate
                    ? ($$anchor) => {
                          const fragment = getRoot(node.alternate);

                          handle(
                              node.alternate,
                              document.createTreeWalker(fragment),
                              pushNewScope(ctx, {}),
                          );

                          $.append($$anchor, fragment);
                      }
                    : undefined,
                node.elseif,
            );

            break;
        }

        case "ForBlock": {
            const anchor = /** @type {Comment} */ (walker.currentNode);

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

                    $.append($$anchor, fragment);
                },
                node.fallback
                    ? ($$anchor) => {
                          const fragment = getRoot(node.fallback);

                          handle(
                              node.fallback,
                              document.createTreeWalker(fragment),
                              pushNewScope(ctx, {}),
                          );

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
 * @param {import("../../compiler/parse/types").Any} node
 * @returns {DocumentFragment}
 */
function getRoot(node) {
    // @ts-ignore
    return node.__root();
}

/**
 * @param {Ctx} ctx
 * @param {any} [newScope={}]
 */
function pushNewScope(ctx, newScope = {}) {
    return { ...ctx, scope: [...ctx.scope, newScope] };
}
