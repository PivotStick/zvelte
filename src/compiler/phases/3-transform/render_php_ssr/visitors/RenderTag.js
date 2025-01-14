import * as b from "../builders.js";
import { outputName } from "../index.js";
import { empty_comment } from "../shared/utils.js";

/**
 * @param {import("#ast").RenderTag} node
 * @param {import("../types.js").ComponentContext} context
 */
export function RenderTag(node, { state, visit }) {
    const callee = /** @type {any} */ (
        visit(
            node.expression.type === "CallExpression"
                ? node.expression.callee
                : node.expression.name,
        )
    );

    const args = [b.variable(outputName)];

    for (const arg of node.expression.arguments) {
        args.push(/** @type {any} */ (visit(arg)));
    }

    const call = b.call(callee, args, true);

    if (node.expression.optional) {
        const test = b.call(b.id("is_callable"), [callee]);

        state.template.push(b.if(test, b.block([b.stmt(call)])));
    } else {
        state.template.push(b.stmt(call));
    }

    if (!state.skipHydrationBoundaries) {
        state.template.push(empty_comment);
    }
}
