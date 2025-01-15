/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";
import { propsName } from "../index.js";

/**
 * @param {AST.FilterExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function FilterExpression(node, { visit }) {
    const args = [b.variable(propsName), b.string(node.name.name)];

    for (const arg of node.arguments) {
        args.push(/** @type {any} */ (visit(arg)));
    }

    return b.call("Internal::filter", args);
}
