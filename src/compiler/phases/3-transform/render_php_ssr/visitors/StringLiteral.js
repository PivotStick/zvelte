/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.StringLiteral} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function StringLiteral(node, context) {
    return b.string(node.value);
}
