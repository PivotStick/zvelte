import * as b from "../../builders.js";

/**
 * @param {import("estree").Statement[]} update
 */
export function build_render_statement(update) {
    return update.length === 1
        ? build_update(update[0])
        : b.stmt(b.call("$.template_effect", b.thunk(b.block(update))));
}

/**
 * @param {import("estree").Statement} statement
 */
export function build_update(statement) {
    const body =
        statement.type === "ExpressionStatement"
            ? statement.expression
            : b.block([statement]);

    return b.stmt(b.call("$.template_effect", b.thunk(body)));
}
