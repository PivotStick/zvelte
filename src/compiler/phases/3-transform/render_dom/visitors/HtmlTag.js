import { is_ignored } from "../../../../state.js";
import * as b from "../builders.js";

/**
 * @param {import("#ast").HtmlTag} node
 * @param {import("../types.js").ComponentContext} context
 */
export function HtmlTag(node, context) {
    context.state.template.push("<!>");

    // push into init, so that bindings run afterwards, which might trigger another run and override hydration
    context.state.init.push(
        b.stmt(
            b.call(
                "$.html",
                context.state.node,
                b.thunk(
                    /** @type {import("estree").Expression} */ (
                        context.visit(node.expression)
                    ),
                ),
                b.literal(context.state.metadata.namespace === "svg"),
                b.literal(context.state.metadata.namespace === "mathml"),
                is_ignored(node, "hydration_html_changed") && b.true,
            ),
        ),
    );
}
