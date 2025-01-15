/** @import { ComponentContext } from '../types.js' */
/** @import * as AST from '#ast' */

import * as b from "../builders.js";
import { build_inline_component } from "../shared/component.js";

/**
 * @param {AST.ZvelteSelf} node
 * @param {ComponentContext} context
 */
export function ZvelteSelf(node, context) {
    build_inline_component(node, b.id("self::render"), context);
}
