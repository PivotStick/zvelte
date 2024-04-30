import { parse } from "../../compiler/parse";
import { getFilter } from "./filters";
import { derived, effect, forBlock, ifBlock, proxy } from "./reactivity";

/**
 * @type {Record<string, (args: { props: any; target: HTMLElement; }) => DocumentFragment>}
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
 * @template {Record<string, any>} [Props = Record<string, any>]
 * @template {Record<string, HTMLElement | undefined>} [BindedElements = Record<string, HTMLElement>]
 * @typedef {{
 *    props: Props;
 *    els: BindedElements;
 *    emit(type: string, detail?: any): void;
 * }} ComponentArgs
 */

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
 * @param {import("../../compiler/parse/types").Element} node
 */
function getZonePathFromNode(node) {
    const zonePath = node.attributes.find((a) => a.name === "zone-path");

    if (!zonePath) throw new Error("Expected zone-path in attributes");

    const value = zonePath.value;

    if (value === true || value.length > 1 || value[0].type !== "Text") {
        throw new Error(
            `"zone-path" cannot be dynamic and need to statictly be a string`,
        );
    }

    return value[0].data;
}

/**
 * @typedef {(
 * | import('../../compiler/parse/types').Text
 * | import('../../compiler/parse/types').FragmentRoot
 * | import('../../compiler/parse/types').Element
 * | import('../../compiler/parse/types').IfBlock
 * | import('../../compiler/parse/types').ForBlock
 * | import('../../compiler/parse/types').ElseBlock
 * | import('../../compiler/parse/types').Variable
 * | import('../../compiler/parse/types').MustacheTag
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
 *  js?: (args: ComponentArgs<Props, any>) => Exposed;
 *  template: string;
 *  target: Element;
 *  props?: Props
 * }} args
 *
 * @returns {{
 *   exposed: Exposed;
 *   on(type: string, listener: (e: CustomEvent) => void): void;
 *   destroy(): void;
 * }}
 */
// @ts-ignore
export function mountComponent({ js, template, target, props = {} }) {
    props = proxy(props);

    currentComponentContext = {
        destroyCallbacks: [],
        mountCallbacks: [],
        listeners: {},
    };

    const componentContext = currentComponentContext;
    const ast = parse(template);

    console.log(ast);

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
            const isInput = node.name === "input";
            const subComponent =
                node.attributes.some((a) => a.name === "zone-name") &&
                node.attributes.some((a) => a.name === "zone-path")
                    ? {
                          key: getZonePathFromNode(node),
                          target: element,
                          /** @type {any} */
                          props: proxy({}),
                      }
                    : false;

            node.attributes.forEach((attr) => {
                if (attr.name === "on" && attr.modifier) {
                    const expression = attr.value[0];
                    if (
                        attr.value === true ||
                        attr.value.length !== 1 ||
                        expression.type === "Text"
                    ) {
                        throw new Error(
                            `Expected an "Expression" but got <${node.name} ${template.slice(attr.start, attr.end)} />`,
                        );
                    }

                    element.addEventListener(attr.modifier, (_event) => {
                        handleExpression(
                            expression,
                            pushNewScope(scope, {
                                ...componentContext.listeners,
                                _event,
                            }),
                        );
                    });

                    return;
                }

                let modifier = (/** @type {any} */ v) => v;

                if (subComponent && attr.name.startsWith("zone-")) {
                    if (attr.modifier) {
                        throw new Error(
                            `Unhandled modifiers are deprecated... directly use ${attr.name}="{{ variable_name_to_directly_pass_to_component }}"`,
                        );
                    }
                }

                const value = derived(() =>
                    modifier(handleAttributeValue(attr, scope)),
                );

                if (subComponent && attr.name.startsWith("zone-data-")) {
                    const key = attr.name
                        .replace(/^zone-data-/, "")
                        .replace(/\-(\w)/g, (_, l) => l.toUpperCase());

                    effect(() => {
                        subComponent.props[key] = value.value;
                    });
                } else if (
                    isInput &&
                    (attr.name === "checked" ||
                        attr.name === "disabled" ||
                        attr.name === "readonly" ||
                        attr.name === "required" ||
                        attr.name === "value")
                ) {
                    const key =
                        attr.name === "readonly" ? "readOnly" : attr.name;

                    effect(() => {
                        // @ts-ignore
                        element[key] = value.value;
                    });
                } else if (
                    isInput &&
                    attr.name === "bind" &&
                    (attr.modifier === "checked" || attr.modifier === "value")
                ) {
                    effect(() => {
                        // @ts-ignore
                        element[attr.modifier] = handleAttributeValue(
                            attr,
                            scope,
                        );
                    });

                    const attrValue = attr.value[0];
                    if (
                        attrValue.type !== "Identifier" &&
                        attrValue.type !== "MemberExpression"
                    ) {
                        throw new Error(
                            `Expected an "Identifier" or a "MemberExpression" but got <input ${template.slice(attr.start, attr.end)} />`,
                        );
                    }

                    element.addEventListener("input", () => {
                        setValueFromNode(
                            attrValue,
                            scope,
                            // @ts-ignore
                            element[attr.modifier],
                        );
                    });
                } else if (attr.name === "bind" && attr.modifier === "this") {
                    const attrValue = attr.value[0];
                    if (
                        attrValue.type !== "Identifier" &&
                        attrValue.type !== "MemberExpression"
                    ) {
                        throw new Error(
                            `Expected an "Identifier" or a "MemberExpression" but got <${node.name} ${template.slice(attr.start, attr.end)} />`,
                        );
                    }

                    effect(() => {
                        setValueFromNode(attrValue, [els], element);
                    });
                } else {
                    effect(() => {
                        if (shouldSkipAttribute(value.value)) {
                            element.removeAttribute(attr.name);
                        } else {
                            element.setAttribute(attr.name, value.value);
                        }
                    });
                }
            });

            if (subComponent) {
                const instantiate = allComponents[subComponent.key];

                if (!instantiate)
                    throw new Error(
                        `Component "${subComponent.key}" not found...`,
                    );

                instantiate({
                    target: subComponent.target,
                    props: subComponent.props,
                });

                return subComponent.target;
            } else {
                node.children.forEach((child) => {
                    element.appendChild(handle(child, scope));
                });
            }

            return element;
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
                    const itemFragment = new DocumentFragment();
                    const itemScope = pushNewScope(scope, {
                        [node.itemVar]: item,
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

                    node.children.forEach((child) =>
                        itemFragment.appendChild(handle(child, itemScope)),
                    );

                    return itemFragment;
                },
                node.else
                    ? () => handle(node.else, pushNewScope(scope))
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
                () => handleExpression(node.expression, scope),
                () => {
                    const fragment = new DocumentFragment();
                    const ifScope = pushNewScope(scope);

                    node.children.forEach((child) => {
                        fragment.appendChild(handle(child, ifScope));
                    });

                    return fragment;
                },
                node.else
                    ? () => handle(node.else, pushNewScope(scope))
                    : undefined,
            );

            return fragment;
        },

        ElseBlock(node, scope) {
            const fragment = new DocumentFragment();

            node.children.forEach((child) =>
                fragment.appendChild(handle(child, scope)),
            );

            return fragment;
        },

        Fragment(node, scope) {
            const fragment = new DocumentFragment();
            node.children.forEach((child) => {
                fragment.appendChild(handle(child, scope));
            });
            return fragment;
        },

        Variable(node, scope) {
            effect(() =>
                setValueFromNode(
                    node.name,
                    scope,
                    handleExpression(node.value, scope),
                ),
            );
            return document.createComment("");
        },

        MustacheTag(node, scope) {
            const text = document.createTextNode("");
            effect(() => {
                text.data = handleExpression(node.expression, scope);
            });
            return text;
        },
    };

    /**
     * @param {*} node
     * @param {Record<string, any>[]} scope
     */
    function handle(node, scope) {
        // @ts-ignore
        const handler = handlers[node?.type];
        if (!handler) throw new Error(`Node "${node?.type}" not handled`);
        return handler(node, scope);
    }

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

    const fragment = handle(ast.html, [props]);

    target.appendChild(fragment);

    componentContext.mountCallbacks.forEach((fn) => {
        const onDestroy = fn();
        if (typeof onDestroy === "function") {
            componentContext.destroyCallbacks.push(onDestroy);
        }
    });

    return {
        on(type, listener) {
            // @ts-ignore
            target.addEventListener(type, listener);
        },

        // @ts-ignore
        exposed,

        destroy() {
            componentContext.destroyCallbacks.forEach((fn) => fn());
        },
    };
}
