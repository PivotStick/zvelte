import { walk } from "estree-walker";
import { getFilter } from "./filters";
import { effect, forBlock, ifBlock, proxy, pushContext } from "./reactivity";

/**
 * @type {Record<string, (args: { props: any; target: HTMLElement; slots: Record<string, () => DocumentFragment> }) => DocumentFragment>}
 */
const allComponents = {};

/**
 * @param {string} key
 * @param {any} component
 */
export function registerComponent(key, component) {
    allComponents[key] = component;
}

/**
 * @param {string} key
 */
export function getComponentByKey(key) {
    return allComponents[key];
}

/**
 * @template T
 * @param {string} identifier
 * @param {Record<string, any>[]} scope
 * @param {T=} fallback
 */
function findScopeFrom(identifier, scope, fallback) {
    if (!Array.isArray(scope))
        throw new Error(`Scope must be a stack of objects`);

    for (let i = scope.length - 1; i >= 0; i--) {
        if (identifier in scope[i]) {
            return scope[i];
        }
    }

    return fallback;
}

/**
 * @param {string} identifier
 * @param {Record<string, any>[]} scope
 */
function searchInScope(identifier, scope) {
    return findScopeFrom(identifier, scope)?.[identifier];
}

/**
 * @param {Record<string, any>[]} scope
 * @param {any} [newScope={}]
 */
function pushNewScope(scope, newScope = {}) {
    return [...scope, newScope];
}

/**
 * @param {import('../../compiler/parse/types').Expression} node
 * @param {Record<string, any>[]} scope
 * @returns {any}
 */
function handleExpression(node, scope) {
    /**
     * @param {typeof node} node
     * @param {Record<string, any>=} ctx
     * @returns {any}
     */
    function traverse(node, ctx) {
        switch (node.type) {
            case "Identifier":
                if (!ctx) return searchInScope(node.name, scope);
                return ctx[node.name];

            case "MemberExpression": {
                const object = traverse(node.object, ctx);
                if (node.computed === true) {
                    return object[traverse(node.property, ctx)];
                }

                return traverse(node.property, object);
            }

            case "ObjectExpression": {
                /** @type {any} */
                const object = {};
                node.properties.forEach((property) => {
                    object[property.key.name] = traverse(property.value);
                });
                return object;
            }

            case "ArrayExpression": {
                /** @type {any[]} */
                const array = [];
                node.elements.forEach((element) => {
                    array.push(traverse(element));
                });
                return array;
            }

            case "BinaryExpression": {
                switch (node.operator) {
                    case "??":
                        return (
                            traverse(node.left, ctx) ??
                            traverse(node.right, ctx)
                        );

                    case "&&":
                        return (
                            traverse(node.left, ctx) &&
                            traverse(node.right, ctx)
                        );

                    case "||":
                        return (
                            traverse(node.left, ctx) ||
                            traverse(node.right, ctx)
                        );
                }

                const left = traverse(node.left, ctx);
                const right = traverse(node.right, ctx);

                switch (node.operator) {
                    case "in":
                        if (Array.isArray(right)) {
                            return right.includes(left);
                        } else if (
                            typeof right === "object" &&
                            right !== null
                        ) {
                            return left in right;
                        }

                        return false;

                    case "~":
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
                const argument = traverse(node.argument, ctx);

                switch (node.operator) {
                    case "not":
                        return !argument;

                    default:
                        throw new Error(
                            `Unhandled UnaryExpression operator "${node.operator}"`,
                        );
                }
            }

            case "ConditionalExpression": {
                const test = traverse(node.test, ctx);
                return test
                    ? traverse(node.consequent, ctx)
                    : traverse(node.alternate, ctx);
            }

            case "StringLiteral":
            case "BooleanLiteral":
            case "NumericLiteral":
            case "NullLiteral": {
                return node.value;
            }

            case "CallExpression":
            case "FilterExpression": {
                const fn =
                    (node.type === "FilterExpression"
                        ? getFilter(node.name.name)
                        : null) ?? traverse(node.name, ctx);

                const args = node.arguments.map((arg) => traverse(arg, ctx));

                return fn(...args);
            }

            default:
                console.error(node);
                // @ts-ignore
                throw new Error(`Unhandled "${node?.type}" expression`);
        }
    }

    return traverse(node);
}

/**
 * @type {{
 *  mountCallbacks: (() => void | (() => void))[];
 *  destroyCallbacks: (() => void)[];
 *  listeners: Record<string, (...args: any[]) => void>;
 * } | undefined}
 */
let currentComponentContext;

/**
 * @param {() => void | (() => void)} callback
 */
export function onMount(callback) {
    if (currentComponentContext) {
        currentComponentContext.mountCallbacks.push(callback);
    }
}

/**
 * @param {() => void} callback
 */
export function onDestroy(callback) {
    if (currentComponentContext) {
        currentComponentContext.destroyCallbacks.push(callback);
    }
}

/**
 * @param {Record<string, (...args: any[]) => void>} listeners
 */
export function setListeners(listeners) {
    if (currentComponentContext) {
        currentComponentContext.listeners = listeners;
    }
}

/**
 * @typedef {(
 * | import('../../compiler/parse/types').Root
 * | import('../../compiler/parse/types').Fragment
 * | import('../../compiler/parse/types').Text
 * | import('../../compiler/parse/types').Comment
 * | import('../../compiler/parse/types').ElementLike
 * | import('../../compiler/parse/types').Block
 * | import('../../compiler/parse/types').Tag
 * )} HandledNode
 */

/**
 * @template {{ type: string }} Node
 * @template {string} TargetType
 * @typedef {Node extends { type: TargetType } ? Node : never} PickNode
 */

/**
 * @typedef {{
 *  [P in HandledNode["type"]]: (node: PickNode<HandledNode, P>, scope: Record<string, any>[]) => any;
 * }} Handlers
 */

/**
 * @template {Record<string, any>} Props
 * @template Exposed
 * @param {{
 *  js?: (args: import(".").ComponentArgs<Props, any>) => Exposed;
 *  ast: import("../../compiler/parse/types").Root;
 *  target: Element;
 *  props?: Props
 *  slots?: Record<string, () => DocumentFragment>;
 * }} args
 *
 * @returns {{
 *   exposed: Exposed;
 *   on(type: string, listener: (e: CustomEvent) => void): void;
 *   destroy(): void;
 * }}
 */
export function mountComponent({
    js,
    ast,
    target,
    // @ts-expect-error
    props = {},
    slots = {},
}) {
    /**
     * @param {any} value
     */
    function shouldSkipAttribute(value) {
        return value === null || value === undefined;
    }

    /**
     * @param {import('../../compiler/parse/types').Attribute} node
     * @param {Record<string, any>[]} scope
     */
    function handleAttributeValue(node, scope) {
        const values = node.value;

        if (values === true) return true;

        /**
         * @param {import("../../compiler/parse/types").Expression | import("../../compiler/parse/types").Text} value
         */
        function handleNode(value) {
            if (value.type === "Text") return value.data;
            return handleExpression(value, scope);
        }

        if (values.length === 1) {
            return handleNode(values[0]);
        }

        return values.map(handleNode).join("");
    }

    /**
     * @param {import('../../compiler/parse/types').MemberExpression | import('../../compiler/parse/types').Identifier} node
     * @param {Record<string, any>[]} scope
     * @param {*} value
     */
    function setValueFromNode(node, scope, value) {
        /**
         * @param {typeof node} node
         * @param {string[]} [path=[]]
         */
        function buildPath(node, path = []) {
            switch (node.type) {
                case "Identifier":
                    path.push(node.name);
                    break;

                case "MemberExpression":
                    buildPath(node.object, path);
                    if (node.computed === true) {
                        path.push(handleExpression(node.property, scope));
                    } else {
                        buildPath(node.property, path);
                    }
                    break;

                default:
                    throw new Error(
                        // @ts-ignore
                        `Unexpected "${node.type}" in setValueFromNode`,
                    );
            }

            return path;
        }

        const path = buildPath(node);

        path.reduce(
            (o, key, i, array) => {
                if (
                    i === array.length - 1 &&
                    typeof o === "object" &&
                    o !== null
                ) {
                    o[key] = value;
                }

                return o?.[key];
            },
            findScopeFrom(path[0], scope, scope[scope.length - 1]),
        );
    }

    /**
     * @type {Handlers}
     */
    const handlers = {
        Element(node, scope) {
            const element = document.createElement(node.name);

            node.attributes.forEach((attr) => {
                switch (attr.type) {
                    case "Attribute": {
                        effect(() => {
                            const value = handleAttributeValue(attr, scope);
                            if (shouldSkipAttribute(attr.value)) {
                                element.removeAttribute(attr.name);
                            } else {
                                element.setAttribute(attr.name, value);
                            }
                        });
                        break;
                    }

                    case "OnDirective": {
                        element.addEventListener(attr.name, (_event) => {
                            handleExpression(
                                attr.expression,
                                pushNewScope(scope, {
                                    ...componentContext.listeners,
                                    _event,
                                }),
                            );
                        });
                        break;
                    }

                    case "BindDirective": {
                        if (element instanceof HTMLInputElement) {
                            effect(() => {
                                element[attr.name] = handleExpression(
                                    attr.expression,
                                    scope,
                                );
                            });
                            element.addEventListener("input", () => {
                                setValueFromNode(
                                    attr.expression,
                                    scope,
                                    element[attr.name],
                                );
                            });
                        }
                        break;
                    }

                    default:
                        // @ts-expect-error
                        throw new Error(`Unhandled "${attr.type}" attribute`);
                }
            });

            element.appendChild(handle(node.fragment, scope));

            return element;
        },

        SlotElement(node, scope) {
            if (!slots.default) return handle(node.fragment, scope);
            return slots.default();
        },

        Text(node) {
            return document.createTextNode(node.data);
        },

        ForBlock(node, scope) {
            const fragment = new DocumentFragment();
            const anchor = document.createComment("");

            fragment.appendChild(anchor);

            forBlock(
                anchor,
                () => handleExpression(node.expression, scope),
                (item, array, index) => {
                    const itemScope = pushNewScope(scope, {
                        [node.context.name]: item,
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
                                return searchInScope("loop", scope);
                            },
                        },
                    });

                    return handle(node.body, itemScope);
                },
                node.fallback
                    ? () => handle(node.fallback, pushNewScope(scope))
                    : undefined,
            );

            return fragment;
        },

        IfBlock(node, scope) {
            const fragment = new DocumentFragment();
            const anchor = document.createComment("");

            fragment.appendChild(anchor);

            ifBlock(
                anchor,
                () => handleExpression(node.test, scope),
                () => handle(node.consequent, pushNewScope(scope)),
                node.alternate
                    ? () => handle(node.alternate, pushNewScope(scope))
                    : undefined,
            );

            return fragment;
        },

        Fragment(node, scope) {
            const fragment = new DocumentFragment();
            node.nodes.forEach((child) => {
                const childNode = handle(child, scope);
                if (childNode) fragment.appendChild(childNode);
            });
            return fragment;
        },

        Root(node, scope) {
            return handle(node.fragment, scope);
        },

        Variable(node, scope) {
            effect(() =>
                setValueFromNode(
                    node.name,
                    scope,
                    handleExpression(node.value, scope),
                ),
            );
        },

        ExpressionTag(node, scope) {
            const text = document.createTextNode("");
            effect(() => {
                text.data = handleExpression(node.expression, scope);
            });

            return text;
        },

        HtmlTag(node, scope) {
            const fragment = new DocumentFragment();
            const anchor = document.createComment("");

            fragment.appendChild(anchor);

            /**
             * @type {Set<Node>}
             */
            const nodesToRemove = new Set();

            effect(() => {
                nodesToRemove.forEach(
                    (node) =>
                        node.isConnected && node.parentNode.removeChild(node),
                );
                nodesToRemove.clear();

                const template = document.createElement("template");

                template.innerHTML = handleExpression(node.expression, scope);
                template.content.childNodes.forEach((child) =>
                    nodesToRemove.add(child),
                );

                anchor.before(template.content);
            });

            return fragment;
        },

        Component(node, scope) {
            const target = document.createElement(node.name);

            const mount = getComponentByKey(node.key.data);

            if (!mount) {
                throw new Error(
                    `Component with key "${node.key.data}" not found`,
                );
            }

            const slots = {
                default: node.fragment.nodes.length
                    ? () => handle(node.fragment, scope)
                    : undefined,
            };

            /** @type {any} */
            const props = proxy({});

            node.attributes.forEach((attr) => {
                switch (attr.type) {
                    case "Attribute":
                        effect(() => {
                            props[attr.name] = handleAttributeValue(
                                attr,
                                scope,
                            );
                        });
                        break;

                    case "OnDirective":
                        target.addEventListener(attr.name, (_event) => {
                            handleExpression(
                                attr.expression,
                                pushNewScope(scope, {
                                    ...componentContext.listeners,
                                    _event,
                                }),
                            );
                        });
                        break;

                    case "BindDirective":
                        effect(() => {
                            setValueFromNode(
                                attr.expression,
                                scope,
                                props[attr.name],
                            );
                        });
                        break;

                    default:
                        throw new Error(
                            // @ts-expect-error
                            `Unexpected "${attr?.type}" in component attributes`,
                        );
                }
            });

            mount({
                target,
                props,
                slots,
            });

            return target;
        },

        Comment() {}, // not handling comments
    };

    /**
     * @param {*} node
     * @param {Record<string, any>[]} scope
     */
    function handle(node, scope) {
        const handler = handlers[node?.type];
        if (!handler) throw new Error(`Node "${node?.type}" not handled`);
        return handler(node, scope);
    }

    const signalsCtx = pushContext();

    props = proxy(props);

    currentComponentContext = {
        destroyCallbacks: [],
        mountCallbacks: [],
        listeners: {},
    };

    const componentContext = currentComponentContext;

    /**
     * @type {Record<string, HTMLElement>}
     */
    const els = {};

    const exposed = js?.({
        props,
        els,
        emit(type, detail) {
            const event = new CustomEvent(type, {
                detail,
            });

            target.dispatchEvent(event);
        },
    });

    currentComponentContext = undefined;

    /**
     * @type {DocumentFragment}
     */
    const fragment = handle(ast, [props]);

    signalsCtx.pop();

    /**
     * @type {Node[]}
     */
    // @ts-expect-error
    const rootNodes = [...fragment.childNodes];

    target.appendChild(fragment);

    componentContext.mountCallbacks.forEach((fn) => {
        const onDestroy = fn();
        if (typeof onDestroy === "function") {
            componentContext.destroyCallbacks.push(onDestroy);
        }
    });

    return {
        on(type, listener) {
            target.addEventListener(type, listener);
        },

        exposed,

        destroy() {
            signalsCtx.flush();
            rootNodes.forEach(
                (node) => node.isConnected && node.parentNode.removeChild(node),
            );
            componentContext.destroyCallbacks.forEach((fn) => fn());
        },
    };
}
