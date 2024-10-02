import { build_component } from "./shared/component.js";

/**
 * @param {import('#ast').ZvelteSelf} node
 * @param {import('../types.js').ComponentContext} context
 */
export function ZvelteSelf(node, context) {
    const component = build_component(
        node,
        context.state.analysis.name,
        context,
    );
    context.state.init.push(component);
}
