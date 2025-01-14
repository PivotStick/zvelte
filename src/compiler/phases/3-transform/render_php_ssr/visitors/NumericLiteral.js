/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.NumericLiteral} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function NumericLiteral(node, context) {
    return b.number(node.value);
}
