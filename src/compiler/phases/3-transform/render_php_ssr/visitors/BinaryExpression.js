/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.BinaryExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function BinaryExpression(node, context) {
    return b.bin(
        // @ts-ignore
        context.visit(node.left),
        node.operator === "~" ? "." : node.operator,
        // @ts-ignore
        context.visit(node.right),
    );
}
