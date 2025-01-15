/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.ObjectExpression} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function ObjectExpression(node, { visit }) {
    const object = new Map();

    for (const prop of node.properties) {
        object.set(
            prop.key.type === "Identifier"
                ? b.string(prop.key.name)
                : visit(prop.key),
            visit(prop.value),
        );
    }

    return b.object(object);
}
