/**
 * @template {{ type: string }} Node
 * @template {string} TargetType
 * @typedef {Node extends { type: TargetType } ? Node : never} PickNode
 */

import { getFilter } from "./filters";

/**
 * @template {{ "type": any }} T
 * @typedef {{
 *  [P in T["type"]]: (node: import("./shared").PickNode<T, P>, scope: Record<string, any>[]) => any;
 * }} Handlers
 */

/**
 * @template T
 * @param {string} identifier
 * @param {Record<string, any>[]} scope
 * @param {T=} fallback
 */
export function findScopeFrom(identifier, scope, fallback) {
    if (!Array.isArray(scope))
        throw new Error(`Scope must be a stack of objects`);

    for (let i = scope.length - 1; i >= 0; i--) {
        if (typeof scope[i] === "object" && identifier in scope[i]) {
            return scope[i];
        }
    }

    return fallback;
}

/**
 * @param {string} identifier
 * @param {Record<string, any>[]} scope
 */
export function searchInScope(identifier, scope) {
    return findScopeFrom(identifier, scope)?.[identifier];
}

/**
 * @param {Record<string, any>[]} scope
 * @param {any} [newScope={}]
 */
export function pushNewScope(scope, newScope = {}) {
    return [...scope, newScope];
}

/**
 * @param {import('../../compiler/parse/types').Expression} node
 * @param {Record<string, any>[]} scope
 * @returns {any}
 */
export function handleExpression(node, scope) {
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
                    object[
                        property.key.type === "StringLiteral"
                            ? property.key.value
                            : property.key.name
                    ] = traverse(property.value);
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
                const left = traverse(node.left, ctx);

                switch (node.operator) {
                    case "??":
                        return left ?? traverse(node.right, ctx);
                }

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
                const argument = traverse(node.argument, ctx);

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

            case "RangeExpression": {
                const values = [];
                for (
                    let i = node.from.value;
                    node.step === 1 ? i < node.to.value : i > node.to.value;
                    i += node.step
                ) {
                    values.push(i);
                }
                return values;
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
 * @param {any} value
 */
export function shouldSkipAttribute(value) {
    return value === null || value === undefined;
}

/**
 * @param {import('../../compiler/parse/types').Attribute} node
 * @param {Record<string, any>[]} scope
 */
export function handleAttributeValue(node, scope) {
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
 * @param {Node} target
 * @param {string} styleSheetId
 * @param {string} styles
 */
export async function appendStyles(target, styleSheetId, styles) {
    const appendStylesTo = getRootForStyle(target);

    if (!appendStylesTo.getElementById(styleSheetId)) {
        const style = document.createElement("style");
        style.id = styleSheetId;
        style.textContent = styles;

        /** @type {Document} */ (
            // @ts-ignore
            appendStylesTo.head || appendStylesTo
        ).appendChild(style);
    }
}

/**
 * @param {Node} node
 */
function getRootForStyle(node) {
    if (!node) return document;
    const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
    if (root && /** @type {ShadowRoot} */ (root).host) {
        return /** @type {ShadowRoot} */ (root);
    }
    return /** @type {Document} */ (node.ownerDocument);
}
