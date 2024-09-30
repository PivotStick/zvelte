import { is_event_attribute } from "../../../../../utils/ast.js";
import { build_template_literal, build_update } from "./utils.js";

import * as b from "../../builders.js";
import { is_ignored } from "../../../../../state.js";
import { normalize_attribute } from "../../../utils.js";

/**
 * @param {import("#ast").Attribute['value']} value
 * @param {import("../../types.js").ComponentContext} context
 * @returns {{ value: import("estree").Expression, has_state: boolean, has_call: boolean }}
 */
export function build_attribute_value(value, context) {
    if (value === true) {
        return { has_state: false, has_call: false, value: b.literal(true) };
    }

    if (!Array.isArray(value) || value.length === 1) {
        const chunk = Array.isArray(value) ? value[0] : value;

        if (chunk.type === "Text") {
            return {
                has_state: false,
                has_call: false,
                value: b.literal(chunk.data),
            };
        }

        return {
            has_state: chunk.metadata.expression.has_state,
            has_call: chunk.metadata.expression.has_call,
            value: /** @type {import("estree").Expression} */ (
                context.visit(chunk.expression)
            ),
        };
    }

    return build_template_literal(value, context.visit, context.state);
}

/**
 * @param {Array<import("#ast").Attribute | import("#ast").SpreadAttribute>} attributes
 * @param {import("../../types.js").ComponentContext} context
 * @param {import("#ast").RegularElement | import("#ast").ZvelteElement} element
 * @param {import("estree").Identifier} element_id
 * @param {import("estree").Identifier} attributes_id
 * @param {false | import("estree").Expression} preserve_attribute_case
 * @param {false | import("estree").Expression} is_custom_element
 */
export function build_set_attributes(
    attributes,
    context,
    element,
    element_id,
    attributes_id,
    preserve_attribute_case,
    is_custom_element,
) {
    let needs_isolation = false;
    let has_state = false;

    /** @type {import("estree").ObjectExpression['properties']} */
    const values = [];

    for (const attribute of attributes) {
        if (attribute.type === "Attribute") {
            const { value } = build_attribute_value(attribute.value, context);

            if (
                is_event_attribute(attribute) &&
                (value.type === "ArrowFunctionExpression" ||
                    value.type === "FunctionExpression")
            ) {
                // Give the event handler a stable ID so it isn't removed and readded on every update
                const id = context.state.scope.generate("event_handler");
                context.state.init.push(b.var(id, value));
                values.push(b.prop("init", attribute.name, b.id(id)));
            } else {
                values.push(b.prop("init", attribute.name, value));
            }

            has_state ||= attribute.metadata.expression.has_state;
        } else {
            values.push(
                b.spread(
                    /** @type {import("estree").Expression} */ (
                        context.visit(attribute)
                    ),
                ),
            );

            // objects could contain reactive getters -> play it safe and always assume spread attributes are reactive
            has_state = true;

            needs_isolation ||= attribute.metadata.expression.has_call;
        }
    }

    const call = b.call(
        "$.set_attributes",
        element_id,
        has_state ? attributes_id : b.literal(null),
        b.object(values),
        context.state.analysis.css !== null &&
            context.state.analysis.css.hash !== "" &&
            b.literal(context.state.analysis.css.hash),
        preserve_attribute_case,
        is_custom_element,
        is_ignored(element, "hydration_attribute_changed") && b.true,
    );

    if (has_state) {
        context.state.init.push(b.let(attributes_id));

        const update = b.stmt(b.assignment("=", attributes_id, call));

        if (needs_isolation) {
            context.state.init.push(build_update(update));
            return false;
        }

        context.state.update.push(update);
        return true;
    }

    context.state.init.push(b.stmt(call));
    return false;
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
