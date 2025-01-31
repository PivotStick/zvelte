/** @import * as AST from '#ast' */
/** @import { ComponentContext, Expression } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.MemberExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function MemberExpression(node, { state, path, visit }) {
    const parent = path[path.length - 1];

    let what = /** @type {any} */ (visit(node.object));
    let offset = /** @type {any} */ (visit(node.property));

    /** @type {Expression} */
    let member;

    if (node.computed) {
        member = b.ternary(
            b.call("is_array", [what]),
            b.offsetLookup(what, offset),
            b.propertyLookup(what, b.encapsedPart(offset), node.optional),
        );
    } else {
        member = b.propertyLookup(what, offset, node.optional);
    }

    if (!state.isInIsset && parent?.type !== "MemberExpression") {
        member = b.silent(member);
    }

    return member;
}
