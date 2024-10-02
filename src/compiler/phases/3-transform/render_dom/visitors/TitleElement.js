import { build_template_literal } from "./shared/utils.js";
import * as b from "../builders.js";

/**
 * @param {import('#ast').TitleElement} node
 * @param {import('../types.js').ComponentContext} context
 */
export function TitleElement(node, context) {
    const { has_state, value } = build_template_literal(
        /** @type {any} */ (node.fragment.nodes),
        context.visit,
        context.state,
    );

    const statement = b.stmt(
        b.assignment("=", b.id("$.document.title"), value),
    );

    if (has_state) {
        context.state.update.push(statement);
    } else {
        context.state.init.push(statement);
    }
}
