/** @import { ComponentContext, Block } from '../types.js' */
/** @import * as AST from '#ast' */

import * as b from "../builders.js";

/**
 * @param {AST.ZvelteHead} node
 * @param {ComponentContext} context
 */
export function ZvelteHead(node, context) {
    const block = /** @type {Block} */ (context.visit(node.fragment));

    context.state.template.push(
        b.stmt(
            b.call("Internal::head", [
                b.id("$payload"),
                b.closure(true, [b.parameter("payload", "object")], [], block),
            ]),
        ),
    );
}
