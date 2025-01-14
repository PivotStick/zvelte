import * as b from "../builders.js";

import { clean_nodes, infer_namespace } from "../../utils.js";
import {
    build_template,
    empty_comment,
    process_children,
} from "../shared/utils.js";

/**
 * @param {import("#ast").Fragment} node
 * @param {import("../types.js").ComponentContext} context
 *
 * @returns {any}
 */
export function Fragment(node, context) {
    const parent = context.path.at(-1) ?? node;
    const namespace = infer_namespace(
        context.state.namespace,
        parent,
        node.nodes,
    );

    const { hoisted, trimmed, is_standalone, is_text_first } = clean_nodes(
        parent,
        node.nodes,
        context.path,
        namespace,
        context.state,
        context.state.options.preserveWhitespace,
        context.state.options.preserveComments,
    );

    /** @type {import("../types.js").ComponentServerTransformState} */
    const state = {
        ...context.state,
        init: [],
        template: [],
        namespace,
        skipHydrationBoundaries: is_standalone,
    };

    for (const node of hoisted) {
        context.visit(node, state);
    }

    if (is_text_first) {
        // insert `<!---->` to prevent this from being glued to the previous fragment
        state.template.push(empty_comment);
    }

    process_children(trimmed, { ...context, state });

    return b.block([...state.init, ...build_template(state.template)]);
}
