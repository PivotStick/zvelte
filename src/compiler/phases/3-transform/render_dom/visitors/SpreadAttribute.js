/**
 * @param {import('#ast').SpreadAttribute} node
 * @param {import('../types.js').ComponentContext} context
 */
export function SpreadAttribute(node, context) {
    return context.visit(node.expression);
}
