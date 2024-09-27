/**
 * @param {import("#ast").Comment} node
 * @param {import("../types.js").ComponentContext} context
 */
export function Comment(node, context) {
    // We'll only get here if comments are not filtered out, which they are unless preserveComments is true
    context.state.template.push(`<!--${node.data}-->`);
}
