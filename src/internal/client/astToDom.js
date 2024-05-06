import { walk } from "estree-walker";
import { hash } from "../../compiler/parse/utils/hash";
import { astToString } from "./astToString";
import * as cssTree from "css-tree";
import {
    effect,
    forBlock,
    ifBlock,
    proxy,
    pushContext,
    source,
} from "./reactivity";
import {
    appendStyles,
    findScopeFrom,
    handleAttributeValue,
    handleExpression,
    pushNewScope,
    searchInScope,
    shouldSkipAttribute,
} from "./shared";

/**
 * @type {Record<string, (args: { props: any; target: HTMLElement; slots: Record<string, () => DocumentFragment> }) => ReturnType<typeof mountComponent>>}
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
 * @type {{
 *  mountCallbacks: (() => void | (() => void))[];
 *  destroyCallbacks: (() => void)[];
 *  listeners: import("./types").Listeners,
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
 * @param {import("./types").Listeners} listeners
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
     * @param {import("../../compiler/parse/types").Element} node
     * @param {Record<string, any>[]} scope
     */
    function handleSVG(node, scope) {
        const template = document.createElement("template");
        template.innerHTML = astToString(node, scope);
        return template.content;
    }

    /**
     * @type {import("./shared").Handlers<HandledNode>}
     */
    const handlers = {
        Element(node, scope) {
            if (node.name === "svg") return handleSVG(node, scope);
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
                        if (attr.name === "this") {
                            effect(() => {
                                setValueFromNode(
                                    attr.expression,
                                    [els],
                                    element,
                                );
                            });
                        } else if (element instanceof HTMLInputElement) {
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
            if (node.css) {
                const styleSheetId = "zvelte-" + hash(node.css.code);
                walk(node.fragment, {
                    leave(
                        /** @type {import("../../compiler/parse/types").Any} */ node,
                    ) {
                        if (node.type === "Element") {
                            let classAttr = node.attributes.find(
                                (attr) =>
                                    attr.type === "Attribute" &&
                                    attr.name === "class",
                            );
                            if (classAttr?.type !== "Attribute") {
                                classAttr = {
                                    type: "Attribute",
                                    name: "class",
                                    start: -1,
                                    end: -1,
                                    value: [],
                                };
                                node.attributes.push(classAttr);
                            }

                            if (classAttr.value !== true) {
                                let text = classAttr.value.find(
                                    (t) => t.type === "Text",
                                );
                                if (text?.type !== "Text") {
                                    text = {
                                        type: "Text",
                                        end: -1,
                                        start: -1,
                                        data: "",
                                    };
                                    classAttr.value.push(text);
                                }

                                if (text.data.trim() !== "") {
                                    text.data += " ";
                                }
                                text.data += styleSheetId;
                            }
                        }
                    },
                });

                cssTree.walk(node.css.ast, {
                    leave(node) {
                        if (node.type === "Selector") {
                            node.children.push({
                                type: "ClassSelector",
                                name: styleSheetId,
                                loc: null,
                            });
                        }
                    },
                });

                node.css.code = cssTree.generate(node.css.ast);

                appendStyles(undefined, styleSheetId, node.css.code);
            }
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
            /**
             * @type {import("./reactivity").Source<null | ReturnType<typeof mount>>}
             */
            const instance = source(null);

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
                        if (attr.name === "this") {
                            effect(() => {
                                setValueFromNode(
                                    attr.expression,
                                    [els],
                                    instance.value,
                                );
                            });
                        } else {
                            effect(() => {
                                setValueFromNode(
                                    attr.expression,
                                    scope,
                                    props[attr.name],
                                );
                            });
                        }
                        break;

                    default:
                        throw new Error(
                            // @ts-expect-error
                            `Unexpected "${attr?.type}" in component attributes`,
                        );
                }
            });

            instance.value = mount({
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
