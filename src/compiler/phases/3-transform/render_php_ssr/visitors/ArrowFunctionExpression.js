/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
// ArrowFunctionExpression(node, { visit, state }) {
//     const args = [];
//     const nonPropVars = [];
//
//     for (const arg of node.params) {
//         nonPropVars.push(arg.name);
//         args.push(b.variable(arg.name));
//     }
//
//     const body = /** @type {any} */ (
//         visit(node.body, {
//             ...state,
//             nonPropVars: [...state.nonPropVars, ...nonPropVars],
//         })
//     );
//
//     return b.arrow(args, body);
// },
