/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.RangeExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function RangeExpression(node, { visit }) {
    const start = /** @type {any} */ (visit(node.from));
    const end = /** @type {any} */ (visit(node.to));

    return b.call(b.id("range"), [start, end, b.number(node.step)]);
}
