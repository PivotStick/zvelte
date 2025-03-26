/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.AssignmentExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function AssignmentExpression(node, { visit, state }) {
    if (
        node.left.type === "Identifier" &&
        node.right.type === "FilterExpression" &&
        node.right.name.name === "$derived"
    ) {
        state.overrides[node.left.name] = b.variable(
            state.unique(node.left.name),
        );
    }

    return b.assign(
        /** @type {any} */ (visit(node.left)),
        node.operator === "~=" ? ".=" : node.operator,
        /** @type {any} */ (visit(node.right)),
    );
}
