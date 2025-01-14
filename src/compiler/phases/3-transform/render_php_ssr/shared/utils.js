/** @import * as AST from "#ast" */
/** @import { ComponentContext, Expression } from '../types.js' */

import { escape_html } from "../../../../escaping.js";
import { sanitize_template_string } from "../../../../utils/sanitize_template_string.js";
import { regex_whitespaces_strict } from "../../../patterns.js";
import {
    BLOCK_CLOSE,
    BLOCK_OPEN,
    BLOCK_OPEN_ELSE,
    EMPTY_COMMENT,
} from "../../hydration.js";
import * as b from "../builders.js";

export const empty_comment = b.string(EMPTY_COMMENT);
export const block_close = b.string(BLOCK_CLOSE);
export const block_open = b.string(BLOCK_OPEN);
export const block_open_else = b.string(BLOCK_OPEN_ELSE);

/**
 * Processes an array of template nodes, joining sibling text/expression nodes and
 * recursing into child nodes.
 * @param {Array<AST.ZvelteNode>} nodes
 * @param {ComponentContext} context
 */
export function process_children(nodes, { visit, state }) {
    /** @type {Array<AST.Text | AST.Comment | AST.ExpressionTag>} */
    let sequence = [];

    function flush() {
        let quasi = b.quasi("", false);
        const quasis = [quasi];

        /** @type {import("../types.js").Expression[]} */
        const expressions = [];

        for (let i = 0; i < sequence.length; i++) {
            const node = sequence[i];

            if (node.type === "Text" || node.type === "Comment") {
                quasi.value.cooked +=
                    node.type === "Comment"
                        ? `<!--${node.data}-->`
                        : escape_html(node.data);
            } else if (
                node.type === "ExpressionTag" &&
                (node.expression.type === "NullLiteral" ||
                    node.expression.type === "BooleanLiteral" ||
                    node.expression.type === "StringLiteral" ||
                    node.expression.type === "NumericLiteral")
            ) {
                if (node.expression.value != null) {
                    quasi.value.cooked += escape_html(
                        node.expression.value + "",
                    );
                }
            } else {
                expressions.push(
                    b.call("Internal::escape", [
                        /** @type {import("../types.js").Expression} */ (
                            visit(node.expression)
                        ),
                    ]),
                );

                quasi = b.quasi("", i + 1 === sequence.length);
                quasis.push(quasi);
            }
        }

        for (const quasi of quasis) {
            quasi.value.raw = sanitize_template_string(
                /** @type {string} */ (quasi.value.cooked),
            );
        }

        state.template.push(b.template(quasis, expressions));
    }

    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];

        if (
            node.type === "Text" ||
            node.type === "Comment" ||
            node.type === "ExpressionTag"
        ) {
            sequence.push(node);
        } else {
            if (sequence.length > 0) {
                flush();
                sequence = [];
            }

            visit(node, { ...state });
        }
    }

    if (sequence.length > 0) {
        flush();
    }
}

/**
 * @param {Array<import("../types.js").Statement | import("../types.js").Expression>} template
 * @param {import("../types.js").Identifier} out
 * @param {import("../types.js").AssignmentOperator} operator
 * @returns {import("../types.js").Statement[]}
 */
export function build_template(
    template,
    out = b.id("$payload->out"),
    operator = ".=",
) {
    /** @type {string[]} */
    let strings = [];

    /** @type {import("../types.js").Expression[]} */
    let expressions = [];

    /** @type {import("../types.js").Statement[]} */
    const statements = [];

    const flush = () => {
        statements.push(
            b.assign(
                out,
                operator,
                b.template(
                    strings.map((cooked, i) =>
                        b.quasi(cooked, i === strings.length - 1),
                    ),
                    expressions,
                ),
            ),
        );
        strings = [];
        expressions = [];
    };

    for (let i = 0; i < template.length; i++) {
        const node = template[i];

        if (is_statement(node)) {
            if (strings.length !== 0) {
                flush();
            }

            statements.push(node);
        } else {
            if (strings.length === 0) {
                strings.push("");
            }

            if (
                node.kind === "number" ||
                node.kind === "string" ||
                node.kind === "boolean"
            ) {
                strings[strings.length - 1] += node.value;
            } else if (node.kind === "nullkeyword") {
                strings[strings.length - 1] += "null";
            } else if (node.kind === "template") {
                strings[strings.length - 1] += node.quasis[0].value.cooked;
                strings.push(
                    ...node.quasis
                        .slice(1)
                        .map((q) => /** @type {string} */ (q.value.cooked)),
                );
                expressions.push(...node.expressions);
            } else {
                expressions.push(node);
                strings.push("");
            }
        }
    }

    if (strings.length !== 0) {
        flush();
    }

    return statements;
}

/**
 * @param {import("../types.js").Node} node
 * @returns {node is import("../types.js").Statement}
 */
function is_statement(node) {
    return (
        node.kind === "expressionstatement" ||
        node.kind === "if" ||
        node.kind === "foreach" ||
        node.kind === "block"
    );
}

/**
 *
 * @param {AST.Attribute['value']} value
 * @param {ComponentContext} context
 * @param {boolean} trim_whitespace
 * @param {boolean} is_component
 * @returns {Expression}
 */
export function build_attribute_value(
    value,
    context,
    trim_whitespace = false,
    is_component = false,
) {
    if (value === true) {
        return b.true;
    }

    if (!Array.isArray(value) || value.length === 1) {
        const chunk = Array.isArray(value) ? value[0] : value;

        if (chunk.type === "Text") {
            const data = trim_whitespace
                ? chunk.data.replace(regex_whitespaces_strict, " ").trim()
                : chunk.data;

            return b.literal(is_component ? data : escape_html(data, true));
        }

        return /** @type {Expression} */ (context.visit(chunk.expression));
    }

    let quasi = b.quasi("", false);
    const quasis = [quasi];

    /** @type {Expression[]} */
    const expressions = [];

    for (let i = 0; i < value.length; i++) {
        const node = value[i];

        if (node.type === "Text") {
            quasi.value.raw += trim_whitespace
                ? node.data.replace(regex_whitespaces_strict, " ")
                : node.data;
        } else {
            expressions.push(
                b.call(
                    "$.stringify",
                    /** @type {Expression} */ (context.visit(node.expression)),
                ),
            );

            quasi = b.quasi("", i + 1 === value.length);
            quasis.push(quasi);
        }
    }

    return b.template(quasis, expressions);
}
