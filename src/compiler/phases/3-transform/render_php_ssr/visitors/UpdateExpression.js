/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.UpdateExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function UpdateExpression(node, { visit }) {
    const type = node.operator === "++" ? "+" : "-";
    const what = /** @type {any} */ (visit(node.argument));

    return node.prefix ? b.pre(type, what) : b.post(type, what);
}
