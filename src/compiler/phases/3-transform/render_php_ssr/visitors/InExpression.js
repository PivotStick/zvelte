/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.InExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function InExpression(node, { visit }) {
    const right = /** @type {any} */ (visit(node.right));
    const left = /** @type {any} */ (visit(node.left));

    const expression = b.call("Internal::in", [left, right]);

    return node.not ? b.unary("!", expression) : expression;
}
