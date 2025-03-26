/** @import * as AST from '#ast' */
/** @import { ComponentContext, Block } from '../types.js' */

import * as b from "../builders.js";
import { propsName } from "../index.js";

/**
 * @param {AST.SnippetBlock} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function SnippetBlock(node, context) {
    const state = {
        ...context.state,
        overrides: {
            ...context.state.overrides,
        },
    };

    for (const param of node.parameters) {
        state.overrides[param.name] = b.variable(param.name);
    }

    const fn = b.closure(
        false,
        [
            b.parameter("payload"),
            ...node.parameters.map((p) => b.parameter(p.name)),
        ],
        [b.variable("props")],
        /** @type {Block} */ (context.visit(node.body, state)),
    );

    context.state.init.push(
        b.stmt(
            b.assign(
                b.propertyLookup(
                    b.variable(propsName),
                    b.id(node.expression.name),
                ),
                "=",
                fn,
            ),
        ),
    );
}
