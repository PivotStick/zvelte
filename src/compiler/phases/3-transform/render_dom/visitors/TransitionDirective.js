import { parse_directive_name } from "./shared/utils.js";
import * as b from "../builders.js";
import {
    TRANSITION_GLOBAL,
    TRANSITION_IN,
    TRANSITION_OUT,
} from "../../../constants.js";

/**
 * @param {import('#ast').TransitionDirective} node
 * @param {import('../types.js').ComponentContext} context
 */
export function TransitionDirective(node, context) {
    let flags = node.modifiers.includes("global") ? TRANSITION_GLOBAL : 0;
    if (node.intro) flags |= TRANSITION_IN;
    if (node.outro) flags |= TRANSITION_OUT;

    const args = [
        b.literal(flags),
        context.state.node,
        b.thunk(
            /** @type {import('estree').Expression} */ (
                context.visit(parse_directive_name(node.name))
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

    // in after_update to ensure it always happens after bind:this
    context.state.after_update.push(b.stmt(b.call("$.transition", ...args)));
}
