import * as b from "../../builders.js";

/**
 * Turns `foo` into `$.get(foo)`
 * @param {import('estree').Identifier} node
 */
export function get_value(node) {
    return b.call("$.get", node);
}
