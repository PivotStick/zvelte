/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.BooleanLiteral} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function BooleanLiteral(node, context) {
    return b.boolean(node.value);
}
