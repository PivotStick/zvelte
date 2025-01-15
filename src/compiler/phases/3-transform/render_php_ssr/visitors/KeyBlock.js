/** @import * as AST from '#ast' */
/** @import { ComponentContext, Block } from '../types.js' */

import { empty_comment } from "../shared/utils.js";

/**
 * @param {AST.KeyBlock} node
 * @param {ComponentContext} context
 */
export function KeyBlock(node, context) {
    context.state.template.push(
        empty_comment,
        /** @type {Block} */ (context.visit(node.fragment)),
        empty_comment,
    );
}
