/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.UnaryExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function UnaryExpression(node, { visit }) {
    const what = /** @type {any} */ (visit(node.argument));
    const operator = node.operator === "not" ? "!" : node.operator;

    return b.unary(operator, what);
}
