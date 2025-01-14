/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.Identifier} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function Identifier(node, context) {
    return b.silent(b.propertyLookup(b.variable("props"), b.id(node.name)));
}

//     const parent = path[path.length - 1];
//
//     let id = propsName;
//
//     if (
//         state.scopeVars.includes(node.name) &&
//         (parent.type !== "MemberExpression" || parent.computed)
//     ) {
//         id = "scope";
//     } else {
//         if (parent.type === "MemberExpression" && !parent.computed) {
//             return b.id(node.name);
//         }
//
//         if (state.nonPropVars.includes(node.name)) {
//             return b.variable(node.name);
//         }
//     }
//
//     const out = b.propertyLookup(b.variable(propsName), b.id(node.name));
//
//     if (!state.isInIsset) {
//         return b.silent(out);
//     }
//
//     return out;
