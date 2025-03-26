/** @import * as AST from '#ast' */
/** @import { ComponentContext, Expression, Statement, Block } from '../types.js' */

import * as b from "../builders.js";
import { block_close, block_open, block_open_else } from "../shared/utils.js";

/**
 * @param {AST.ForBlock} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function ForBlock(node, context) {
    const state = context.state;

    const each_node_meta = node.metadata;
    const collection = /** @type {Expression} */ (
        context.visit(node.expression)
    );

    const array_id = b.variable(context.state.unique("each_array"));

    const index =
        each_node_meta.contains_group_binding || !node.index
            ? b.variable(context.state.unique("index"))
            : b.variable(context.state.unique(node.index.name));

    const length_id = b.variable(context.state.unique("length"));

    state.init.push(
        b.stmt(
            b.assign(
                array_id,
                "=",
                b.call("Internals::ensure_array_like", [collection]),
            ),
        ),
    );

    /** @type {Statement[]} */
    const each = [];

    if (node.context) {
        each.push(
            b.stmt(
                b.assign(
                    b.variable(node.context.name),
                    "=",
                    b.offsetLookup(array_id, index),
                ),
            ),
        );
    }

    if (index.name !== node.index?.name && node.index != null) {
        each.push(b.stmt(b.assign(b.variable(node.index.name), "=", index)));
    }

    each.push(
        .../** @type {Block} */ (
            context.visit(node.body, {
                ...context.state,
                overrides: {
                    ...context.state.overrides,
                    [node.context.name]: b.variable(node.context.name),
                },
            })
        ).children,
    );

    const for_loop = b.for(
        [
            b.assign(index, "=", b.number(0)),
            b.assign(length_id, "=", b.call("count", [array_id])),
        ],
        b.bin(index, "<", length_id),
        b.post("+", index),
        each,
    );

    if (node.fallback) {
        const open = b.stmt(b.assign(b.id("$payload->out"), ".=", block_open));

        const fallback = /** @type {Block} */ (context.visit(node.fallback));

        fallback.children.unshift(
            b.stmt(b.assign(b.id("$payload->out"), ".=", block_open_else)),
        );

        state.template.push(
            b.if(
                b.bin(b.call("count", [array_id]), "!==", b.literal(0)),
                b.block([open, for_loop]),
                fallback,
            ),
            block_close,
        );
    } else {
        state.template.push(block_open, for_loop, block_close);
    }
}
