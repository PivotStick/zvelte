/** @import * as AST from '#ast' */

/** @import { ComponentContext, Expression, Block } from '../types.js' */

import * as b from "../builders.js";
import { block_close, block_open, block_open_else } from "../shared/utils.js";

/**
 * @param {AST.IfBlock} node
 * @param {ComponentContext} context
 */
export function IfBlock(node, context) {
    const test = /** @type {Expression} */ (context.visit(node.test));

    const consequent = /** @type {Block} */ (context.visit(node.consequent));

    const alternate = node.alternate
        ? /** @type {Block} */ (context.visit(node.alternate))
        : b.block([]);

    consequent.children.unshift(
        b.stmt(b.assign(b.id("$payload->out"), ".=", block_open)),
    );

    alternate.children.unshift(
        b.stmt(b.assign(b.id("$payload->out"), ".=", block_open_else)),
    );

    context.state.template.push(b.if(test, consequent, alternate), block_close);
}
