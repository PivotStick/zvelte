/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.NullLiteral} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function NullLiteral(node, context) {
    return b.nullKeyword();
}
