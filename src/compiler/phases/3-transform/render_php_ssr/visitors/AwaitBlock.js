/** @import * as AST from '#ast' */
/** @import { ComponentContext, Expression, Block } from '../types.js' */

import * as b from "../builders.js";
import { empty_comment } from "../shared/utils.js";

const noop = b.closure(true, [], [], b.block([]));

/**
 * @param {AST.AwaitBlock} node
 * @param {ComponentContext} context
 *
 * @returns {any};
 */
export function AwaitBlock(node, context) {
    /**
     * @param {any} name
     */
    function override(name) {
        if (typeof name === "string") {
            return {
                ...context.state,
                overrides: {
                    ...context.state.overrides,
                    [name]: b.variable(name),
                },
            };
        }

        return context.state;
    }

    context.state.template.push(
        empty_comment,
        b.stmt(
            b.call("Internals::await", [
                /** @type {Expression} */ (context.visit(node.expression)),
                node.pending
                    ? b.closure(
                          true,
                          [],
                          [b.variable("props")],
                          /** @type {Block} */ (context.visit(node.pending)),
                      )
                    : noop,
                node.then
                    ? b.closure(
                          true,
                          node.value ? [b.parameter(node.value.name)] : [],
                          [b.variable("props")],
                          /** @type {Block} */ (
                              context.visit(
                                  node.then,
                                  override(node.value?.name),
                              )
                          ),
                      )
                    : noop,
                node.catch
                    ? b.closure(
                          true,
                          node.error ? [b.parameter(node.error.name)] : [],
                          [b.variable("props")],
                          /** @type {Block} */ (
                              context.visit(
                                  node.catch,
                                  override(node.error?.name),
                              )
                          ),
                      )
                    : noop,
            ]),
        ),
        empty_comment,
    );
}
