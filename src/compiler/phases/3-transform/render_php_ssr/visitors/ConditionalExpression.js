/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.ConditionalExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function ConditionalExpression(node, { visit }) {
    const test = /** @type {any} */ (visit(node.test));
    const consequent = /** @type {any} */ (visit(node.consequent));
    const alternate = /** @type {any} */ (visit(node.alternate));

    return b.ternary(test, consequent, alternate);
}
