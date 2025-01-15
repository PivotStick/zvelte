/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.AssignmentExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function AssignmentExpression(node, { visit }) {
    return b.assign(
        /** @type {any} */ (visit(node.left)),
        node.operator === "~=" ? ".=" : node.operator,
        /** @type {any} */ (visit(node.right)),
    );
}
