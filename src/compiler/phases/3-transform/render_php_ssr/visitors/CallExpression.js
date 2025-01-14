/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
// CallExpression(node, { visit }) {
//     const what = /** @type {any} */ (visit(node.callee));
//     const args = [];
//
//     for (const arg of node.arguments) {
//         args.push(/** @type {any} */ (visit(arg)));
//     }
//
//     const call = b.call(what, args, true);
//
//     if (node.optional) {
//         return b.ternary(
//             b.call("is_callable", [what]),
//             call,
//             b.nullKeyword(),
//         );
//     }
//
//     return call;
// },
