import * as b from "../builders.js";

/**
 * @param {import('#ast').RenderTag} node
 * @param {import('../types.js').ComponentContext} context
 */
export function RenderTag(node, context) {
    context.state.template.push("<!>");
    const callee =
        node.expression.type === "CallExpression"
            ? node.expression.callee
            : node.expression.name;
    const raw_args = node.expression.arguments;

    /** @type {import('estree').Expression[]} */
    let args = [];
    for (let i = 0; i < raw_args.length; i++) {
        const raw = raw_args[i];
        const arg = /** @type {import('estree').Expression} */ (
            context.visit(raw)
        );
        if (node.metadata.args_with_call_expression.has(i)) {
            const id = b.id(context.state.scope.generate("render_arg"));
            context.state.init.push(
                b.var(id, b.call("$.derived_safe_equal", b.thunk(arg))),
            );
            args.push(b.thunk(b.call("$.get", id)));
        } else {
            args.push(b.thunk(arg));
        }
    }

    let snippet_function = /** @type {import('estree').Expression} */ (
        context.visit(callee)
    );

    if (node.metadata.dynamic) {
        context.state.init.push(
            b.stmt(
                b.call(
                    "$.snippet",
                    context.state.node,
                    b.thunk(snippet_function),
                    ...args,
                ),
            ),
        );
    } else {
        context.state.init.push(
            b.stmt(
                (node.expression.type === "CallExpression"
                    ? b.call
                    : b.maybe_call)(
                    snippet_function,
                    context.state.node,
                    ...args,
                ),
            ),
        );
    }
}
