/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
// InExpression(node, { state, visit }) {
//     const right = /** @type {any} */ (visit(node.right));
//     const left = /** @type {any} */ (visit(node.left));
//
//     const expression = state.internal("in", left, right);
//
//     return node.not ? b.unary("!", expression) : expression;
// },
