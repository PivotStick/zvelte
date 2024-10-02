import * as b from "../builders.js";

/**
 * @param {import('#ast').ZvelteHead} node
 * @param {import('../types.js').ComponentContext} context
 */
export function ZvelteHead(node, context) {
    // TODO attributes?
    context.state.init.push(
        b.stmt(
            b.call(
                "$.head",
                b.arrow(
                    [b.id("$$anchor")],
                    // @ts-expect-error when visiting a fragment it will always return a BlockStatement
                    /** @type {import('estree').BlockStatement} */ (
                        context.visit(node.fragment)
                    ),
                ),
            ),
        ),
    );
}
