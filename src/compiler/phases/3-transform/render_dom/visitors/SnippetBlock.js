import * as b from "../builders.js";

/**
 * @param {import("#ast").SnippetBlock} node
 * @param {import("../types.js").ComponentContext} context
 */
export function SnippetBlock(node, { visit, state }) {
    const args = [b.id("$$anchor")];
    const params = [];

    for (const param of node.parameters) {
        params.push(param.name);
        args.push(b.id(param.name));
    }

    const privateScope = state.nonPropVars.includes(node.expression.name);
    const id = /** @type {import("estree").Pattern} */ (
        visit(node.expression, state)
    );

    const value = b.arrow(
        args,
        // @ts-expect-error
        /** @type {import("estree").BlockStatement} */ (
            visit(node.body, {
                ...state,
                nonPropGetters: [...state.nonPropGetters, ...params],
            })
        ),
    );

    state.init.push(
        privateScope ? b.var(id, value) : b.assignment("=", id, value),
    );
}
