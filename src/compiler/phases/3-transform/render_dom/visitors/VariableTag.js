/**
 * @param {import('#ast').VariableTag} node
 * @param {import('../types.js').ComponentContext} context
 */
export function VariableTag(node, context) {
    const assignment =
        /** @type {import('estree').AssignmentExpression} */ context.visit(
            node.assignment,
        );

    context.state.init.push(assignment);
}
