/** @import * as AST from '#ast' */
/** @import { ArrayExpression, Expression, Identifier, ObjectExpression } from "estree" */
/** @import { ExpressionMetadata } from "../../../../../types.js" */

import { is_event_attribute } from "../../../../../utils/ast.js";
import {
    build_template_chunk,
    build_template_literal,
    build_update,
    get_expression_id,
} from "./utils.js";

import * as b from "../../builders.js";
import { is_ignored } from "../../../../../state.js";
import { normalize_attribute } from "../../../utils.js";
import { build_class_directives_object } from "../RegularElement.js";

/**
 * @param {Array<AST.Attribute | AST.SpreadAttribute>} attributes
 * @param {AST.ClassDirective[]} class_directives
 * @param {unknown[]} style_directives
 * @param {import("../../types.js").ComponentContext} context
 * @param {AST.RegularElement | AST.ZvelteElement} element
 * @param {Identifier} element_id
 * @param {Identifier} attributes_id
 */
export function build_set_attributes(
    attributes,
    class_directives,
    style_directives,
    context,
    element,
    element_id,
    attributes_id,
) {
    let is_dynamic = false;

    /** @type {ObjectExpression['properties']} */
    const values = [];

    for (const attribute of attributes) {
        if (attribute.type === "Attribute") {
            const { value, has_state } = build_attribute_value(
                attribute.value,
                context,
                (value, metadata) =>
                    metadata.has_call
                        ? get_expression_id(context.state, value)
                        : value,
            );

            if (
                is_event_attribute(attribute) &&
                (value.type === "ArrowFunctionExpression" ||
                    value.type === "FunctionExpression")
            ) {
                // Give the event handler a stable ID so it isn't removed and readded on every update
                const id = context.state.scope.generate("event_handler");
                context.state.init.push(b.var(id, value));
                values.push(b.init(attribute.name, b.id(id)));
            } else {
                values.push(b.init(attribute.name, value));
            }

            is_dynamic ||= has_state;
        } else {
            // objects could contain reactive getters -> play it safe and always assume spread attributes are reactive
            is_dynamic = true;

            let value = /** @type {Expression} */ (context.visit(attribute));

            if (attribute.metadata.expression.has_call) {
                value = get_expression_id(context.state, value);
            }

            values.push(b.spread(value));
        }
    }

    if (class_directives.length) {
        values.push(
            b.prop(
                "init",
                b.array([b.id("$.CLASS")]),
                build_class_directives_object(class_directives, context),
            ),
        );

        is_dynamic ||=
            class_directives.find(
                (directive) => directive.metadata.expression.has_state,
            ) !== null;
    }

    // if (style_directives.length) {
    //     values.push(
    //         b.prop(
    //             "init",
    //             b.array([b.id("$.STYLE")]),
    //             build_style_directives_object(style_directives, context),
    //         ),
    //     );
    //
    //     is_dynamic ||= style_directives.some(
    //         (directive) => directive.metadata.expression.has_state,
    //     );
    // }

    const call = b.call(
        "$.set_attributes",
        element_id,
        is_dynamic ? attributes_id : b.null,
        b.object(values),
        element.metadata.scoped &&
            context.state.analysis.css &&
            context.state.analysis.css.hash !== "" &&
            b.literal(context.state.analysis.css.hash),
        is_ignored(element, "hydration_attribute_changed") && b.true,
    );

    if (is_dynamic) {
        context.state.init.push(b.let(attributes_id));
        const update = b.stmt(b.assignment("=", attributes_id, call));
        context.state.update.push(update);
    } else {
        context.state.init.push(b.stmt(call));
    }
}

/**
 * @param {AST.Attribute['value']} value
 * @param {import("../../types.js").ComponentContext} context
 * @param {(value: Expression, metadata: ExpressionMetadata) => Expression} memoize
 * @returns {{ value: Expression, has_state: boolean }}
 */
export function build_attribute_value(
    value,
    context,
    memoize = (value) => value,
) {
    if (value === true) {
        return { value: b.true, has_state: false };
    }

    if (!Array.isArray(value) || value.length === 1) {
        const chunk = Array.isArray(value) ? value[0] : value;

        if (chunk.type === "Text") {
            return { value: b.literal(chunk.data), has_state: false };
        }

        let expression = /** @type {Expression} */ (
            context.visit(chunk.expression)
        );

        return {
            value: memoize(expression, chunk.metadata.expression),
            has_state: chunk.metadata.expression.has_state,
        };
    }

    return build_template_chunk(value, context.visit, context.state, memoize);
}

/**
 * @param {import("#ast").RegularElement | import("#ast").ZvelteElement} element
 * @param {import("#ast").Attribute} attribute
 */
export function get_attribute_name(element, attribute) {
    if (!element.metadata.svg && !element.metadata.mathml) {
        return normalize_attribute(attribute.name);
    }

    return attribute.name;
}

/**
 * Serializes each class directive into something like `$.class_toogle(element, class_name, value)`
 * and adds it either to init or update, depending on whether or not the value or the attributes are dynamic.
 * @param {import('#ast').ClassDirective[]} class_directives
 * @param {import('estree').Identifier} element_id
 * @param {import("../../types.js").ComponentContext} context
 * @param {boolean} is_attributes_reactive
 */
export function build_class_directives(
    class_directives,
    element_id,
    context,
    is_attributes_reactive,
) {
    const state = context.state;
    for (const directive of class_directives) {
        const { has_state, has_call } = directive.metadata.expression;
        let value = /** @type {import('estree').Expression} */ (
            context.visit(directive.expression)
        );

        if (has_call) {
            const id = b.id(state.scope.generate("class_directive"));

            state.init.push(b.const(id, b.call("$.derived", b.thunk(value))));
            value = b.call("$.get", id);
        }

        const update = b.stmt(
            b.call(
                "$.toggle_class",
                element_id,
                b.literal(directive.name),
                value,
            ),
        );

        if (!is_attributes_reactive && has_call) {
            state.init.push(build_update(update));
        } else if (is_attributes_reactive || has_state || has_call) {
            state.update.push(update);
        } else {
            state.init.push(update);
        }
    }
}

/**
 * @param {Identifier} node_id
 * @param {AST.Attribute} attribute
 * @param {unknown[]} style_directives
 * @param {import("../../types.js").ComponentContext} context
 */
export function build_set_style(node_id, attribute, style_directives, context) {
    let { value, has_state } = build_attribute_value(
        attribute.value,
        context,
        (value, metadata) =>
            metadata.has_call ? get_expression_id(context.state, value) : value,
    );

    /** @type {Identifier | undefined} */
    let previous_id;

    /** @type {ObjectExpression | Identifier | undefined} */
    let prev;

    /** @type {ArrayExpression | ObjectExpression | undefined} */
    let next;

    if (style_directives.length) {
        // next = build_style_directives_object(style_directives, context);
        // has_state ||= style_directives.some(
        //     (d) => d.metadata.expression.has_state,
        // );
        //
        // if (has_state) {
        //     previous_id = b.id(context.state.scope.generate("styles"));
        //     context.state.init.push(b.declaration("let", previous_id));
        //     prev = previous_id;
        // } else {
        //     prev = b.object([]);
        // }
    }

    /** @type {Expression} */
    let set_style = b.call("$.set_style", node_id, value, prev, next);

    if (previous_id) {
        set_style = b.assignment("=", previous_id, set_style);
    }

    (has_state ? context.state.update : context.state.init).push(
        b.stmt(set_style),
    );
}
