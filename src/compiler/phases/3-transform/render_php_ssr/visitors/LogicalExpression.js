/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.LogicalExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function LogicalExpression(node, { visit }) {
    const left = /** @type {any} */ (visit(node.left));
    const right = /** @type {any} */ (visit(node.right));

    let operator;

    switch (node.operator) {
        case "and":
            operator = "&&";
            break;

        case "or":
            operator = "||";
            break;

        default:
            operator = node.operator;
            break;
    }

    return b.bin(left, operator, right);
}
