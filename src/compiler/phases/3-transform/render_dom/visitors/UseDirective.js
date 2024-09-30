import { parse_directive_name } from "./shared/utils.js";
import * as b from "../builders.js";

/**
 * @param {import('#ast').UseDirective} node
 * @param {import('../types.js').ComponentContext} context
 */
export function UseDirective(node, context) {
    const params = [b.id("$$node")];

    if (node.expression) {
        params.push(b.id("$$action_arg"));
    }

    /** @type {import('estree').Expression[]} */
    const args = [
        context.state.node,
        b.arrow(
            params,
            b.call(
                /** @type {import('estree').Expression} */ (
                    context.visit(parse_directive_name(node.name))
                ),
                ...params,
            ),
        ),
    ];

    if (node.expression) {
        args.push(
            b.thunk(
                /** @type {import('estree').Expression} */ (
                    context.visit(node.expression)
                ),
            ),
        );
    }

    // actions need to run after attribute updates in order with bindings/events
    context.state.after_update.push(b.stmt(b.call("$.action", ...args)));
    context.next();
}
