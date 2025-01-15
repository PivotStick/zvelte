/** @import { ComponentContext, Expression } from '../types.js' */
/** @import * as AST from '#ast' */

import * as b from "../builders.js";
import { build_inline_component } from "../shared/component.js";

/**
 * @param {AST.ZvelteComponent} node
 * @param {ComponentContext} context
 */
export function ZvelteComponent(node, context) {
    build_inline_component(
        node,
        /** @type {Expression} */ (context.visit(node.expression)),
        context,
    );
}
