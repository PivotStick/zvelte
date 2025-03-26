/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.ExpressionStatement} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function ExpressionStatement(node, { visit }) {
    return b.stmt(visit(node.expression));
}
