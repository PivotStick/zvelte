/** @import * as AST from '#ast' */
/** @import { ComponentContext } from '../types.js' */

import * as b from "../builders.js";
import { propsName } from "../index.js";

/**
 * @param {AST.Identifier} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function Identifier(node, { path, state }) {
    const parent = path[path.length - 1];

    if (parent.type === "MemberExpression") {
        const root = getRootObject(parent);

        if (root !== node) {
            return b.id(node.name);
        }
    }

    if (state.overrides[node.name]) {
        return state.overrides[node.name];
    }

    const out = b.propertyLookup(b.variable(propsName), b.id(node.name));

    if (!state.isInIsset && parent.type !== "MemberExpression") {
        return b.silent(out);
    }

    return out;
}

/**
 * @param {AST.MemberExpression} member
 */
function getRootObject(member) {
    let object = member.object;

    while (object?.type === "MemberExpression") {
        object = object.object;
    }

    return object;
}
