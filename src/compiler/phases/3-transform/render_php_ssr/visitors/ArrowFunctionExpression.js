/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.ArrowFunctionExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function ArrowFunctionExpression(node, { visit, state }) {
    const args = [];
    const overrides = { ...state.overrides };

    for (const arg of node.params) {
        overrides[arg.name] = b.variable(arg.name);
        args.push(b.parameter(arg.name));
    }

    const body = /** @type {any} */ (
        visit(node.body, {
            ...state,
            overrides,
        })
    );

    return b.arrow(args, body);
}
