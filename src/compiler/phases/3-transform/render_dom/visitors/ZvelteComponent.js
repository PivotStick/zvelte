import { build_component } from "./shared/component.js";

/**
 * @param {import('#ast').ZvelteComponent} node
 * @param {import('../types.js').ComponentContext} context
 */
export function ZvelteComponent(node, context) {
    const component = build_component(node, "$$component", context);
    context.state.init.push(component);
}
