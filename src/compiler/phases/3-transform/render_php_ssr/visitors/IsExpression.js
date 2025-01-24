/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.IsExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function IsExpression(node, { state, visit }) {
    if (node.right.type === "Identifier" && node.right.name === "defined") {
        const left = /** @type {any} */ (
            visit(node.left, {
                ...state,
                isInIsset: true,
            })
        );
        const expression = b.isset(left);
        return node.not ? b.unary("!", expression) : expression;
    }

    const left = /** @type {any} */ (visit(node.left));

    if (node.right.type === "Identifier" && node.right.name === "empty") {
        const expression = b.call("Internals::testEmpty", left);
        return node.not ? b.unary("!", expression) : expression;
    }

    if (node.right.type === "Identifier" && node.right.name === "iterable") {
        const expression = b.call("is_iterable", [left]);
        return node.not ? b.unary("!", expression) : expression;
    }

    const right = /** @type {any} */ (visit(node.right));
    return b.bin(left, node.not ? "!==" : "===", right);
}
