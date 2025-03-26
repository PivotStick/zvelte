/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.BlockStatement} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function BlockStatement(node, { visit, state }) {
    return b.block(node.body.map((statement) => visit(statement)));
}
