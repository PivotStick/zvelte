/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.MemberExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function MemberExpression(node, context) {
    return b.id("__WIP__");
}

// MemberExpression(node, { state, path, visit }) {
//     const parent = path[path.length - 1];
//
//     let what = /** @type {any} */ (visit(node.object));
//     let offset = /** @type {any} */ (visit(node.property));
//
//     if (node.computed) {
//         offset = b.encapsedPart(offset);
//     }
//
//     /** @type {import("./types.js").Expression} */
//     let member = b.propertyLookup(what, offset, node.optional);
//
//     if (member.what.kind === "identifier") {
//         if (!state.nonPropVars.includes(member.what.name)) {
//             member = b.propertyLookup(b.variable(propsName), member);
//         } else if (state.scopeVars.includes(member.what.name)) {
//             member = b.propertyLookup(b.variable("scope"), member);
//         } else {
//             member.what = b.variable(member.what.name);
//         }
//     }
//
//     if (
//         parent.type !== "MemberExpression" ||
//         (parent.computed && !state.isInIsset)
//     ) {
//         member = b.silent(member);
//     }
//
//     return member;
// }
