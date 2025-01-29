/** @import * as AST from '#ast' */
/** @import { ComponentContext, Expression } from '../types.js' */

import * as b from "../builders.js";

/**
 * @param {AST.HtmlTag} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function HtmlTag(node, context) {
    const expression = /** @type {Expression} */ (
        context.visit(node.expression)
    );

    context.state.template.push(b.call("Internals::html", [expression]));
}
