/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
// FilterExpression(node, { state, visit }) {
//     const args = [b.variable(propsName), b.string(node.name.name)];
//
//     for (const arg of node.arguments) {
//         args.push(/** @type {any} */ (visit(arg)));
//     }
//
//     return state.internal("filter", ...args);
// },
