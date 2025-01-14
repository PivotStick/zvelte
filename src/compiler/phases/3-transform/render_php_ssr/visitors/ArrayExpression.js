/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.ArrayExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function ArrayExpression(node, { visit }) {
    const array = b.array();

    for (const element of node.elements) {
        const item = /** @type {any} */ (visit(element));
        array.items.push(b.entry(undefined, item));
    }

    return array;
}
