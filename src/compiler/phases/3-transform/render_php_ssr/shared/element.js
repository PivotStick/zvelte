/** @import * as AST from '#ast' */
/** @import { ComponentContext, ComponentServerTransformState, Expression } from '../types.js' */

import * as b from "../builders.js";

import {
    is_boolean_attribute,
    is_content_editable_binding,
    is_load_error_element,
} from "../../../../../utils.js";
import {
    is_event_attribute,
    is_text_attribute,
} from "../../../../utils/ast.js";

import { regex_starts_with_newline } from "../../../patterns.js";
import { build_attribute_value } from "./utils.js";
import { binding_properties } from "../../../bindings.js";

const WHITESPACE_INSENSITIVE_ATTRIBUTES = ["class", "style"];

/**
 * Writes the output to the template output. Some elements may have attributes on them that require the
 * their output to be the child content instead. In this case, an object is returned.
 * @param {AST.RegularElement | AST.ZvelteElement} node
 * @param {ComponentContext} context
 */
export function build_element_attributes(node, context) {
    /** @type {Array<AST.Attribute | AST.SpreadAttribute>} */
    const attributes = [];

    /** @type {AST.ClassDirective[]} */
    const class_directives = [];

    /** @type {Expression | null} */
    let content = null;

    let has_spread = false;
    // Use the index to keep the attributes order which is important for spreading
    let class_index = -1;
    let style_index = -1;
    let events_to_capture = new Set();

    for (const attribute of node.attributes) {
        if (attribute.type === "Attribute") {
            if (attribute.name === "value") {
                if (node.name === "textarea") {
                    if (
                        attribute.value !== true &&
                        Array.isArray(attribute.value) &&
                        attribute.value[0].type === "Text" &&
                        regex_starts_with_newline.test(attribute.value[0].data)
                    ) {
                        // Two or more leading newlines are required to restore the leading newline immediately after `<textarea>`.
                        // see https://html.spec.whatwg.org/multipage/syntax.html#element-restrictions
                        // also see related code in analysis phase
                        attribute.value[0].data =
                            "\n" + attribute.value[0].data;
                    }
                    content = b.call(
                        "$.escape",
                        build_attribute_value(attribute.value, context),
                    );
                } else if (node.name !== "select") {
                    // omit value attribute for select elements, it's irrelevant for the initially selected value and has no
                    // effect on the selected value after the user interacts with the select element (the value _property_ does, but not the attribute)
                    attributes.push(attribute);
                }

                // omit event handlers except for special cases
            } else if (is_event_attribute(attribute)) {
                if (
                    (attribute.name === "onload" ||
                        attribute.name === "onerror") &&
                    is_load_error_element(node.name)
                ) {
                    events_to_capture.add(attribute.name);
                }
                // the defaultValue/defaultChecked properties don't exist as attributes
            } else if (
                attribute.name !== "defaultValue" &&
                attribute.name !== "defaultChecked"
            ) {
                if (attribute.name === "class") {
                    class_index = attributes.length;

                    if (attribute.metadata.needs_clsx) {
                        const clsx_value = b.call(
                            "Internal::clsx",
                            /** @type {AST.ExpressionTag} */ (attribute.value)
                                .expression,
                        );
                        attributes.push({
                            ...attribute,
                            value: {
                                .../** @type {AST.ExpressionTag} */ (
                                    attribute.value
                                ),
                                expression: context.state.analysis.css?.hash
                                    ? b.bin(
                                          b.bin(
                                              clsx_value,
                                              ".",
                                              b.literal(" "),
                                          ),
                                          ".",
                                          b.literal(
                                              context.state.analysis.css.hash ??
                                                  "",
                                          ),
                                      )
                                    : clsx_value,
                            },
                        });
                    } else {
                        attributes.push(attribute);
                    }
                } else {
                    if (attribute.name === "style") {
                        style_index = attributes.length;
                    }

                    attributes.push(attribute);
                }
            }
        } else if (attribute.type === "BindDirective") {
            if (attribute.name === "value" && node.name === "select") continue;
            if (
                attribute.name === "value" &&
                attributes.some(
                    (attr) =>
                        attr.type === "Attribute" &&
                        attr.name === "type" &&
                        is_text_attribute(attr) &&
                        attr.value[0].data === "file",
                )
            ) {
                continue;
            }
            if (attribute.name === "this") continue;

            const binding = binding_properties[attribute.name];
            if (binding?.omit_in_ssr) continue;

            let expression = /** @type {Expression} */ (
                context.visit(attribute.expression)
            );

            // if (expression.kind === "SequenceExpression") {
            //     expression = b.call(expression.expressions[0]);
            // }

            if (is_content_editable_binding(attribute.name)) {
                content = expression;
            } else if (attribute.name === "value" && node.name === "textarea") {
                content = b.call("$.escape", expression);
            } else if (
                attribute.name === "group"
                /** && attribute.expression.kind !== "SequenceExpression" */
            ) {
                const value_attribute =
                    /** @type {AST.Attribute | undefined} */ (
                        node.attributes.find(
                            (attr) =>
                                attr.type === "Attribute" &&
                                attr.name === "value",
                        )
                    );
                if (!value_attribute) continue;

                const is_checkbox = node.attributes.some(
                    (attr) =>
                        attr.type === "Attribute" &&
                        attr.name === "type" &&
                        is_text_attribute(attr) &&
                        attr.value[0].data === "checkbox",
                );

                attributes.push(
                    create_attribute("checked", -1, -1, [
                        {
                            type: "ExpressionTag",
                            start: -1,
                            end: -1,
                            expression: is_checkbox
                                ? b.call(
                                      b.member(
                                          attribute.expression,
                                          "includes",
                                      ),
                                      build_attribute_value(
                                          value_attribute.value,
                                          context,
                                      ),
                                  )
                                : b.bin(
                                      attribute.expression,
                                      "===",
                                      build_attribute_value(
                                          value_attribute.value,
                                          context,
                                      ),
                                  ),
                            metadata: {
                                expression: create_expression_metadata(),
                            },
                        },
                    ]),
                );
            } else {
                attributes.push(
                    create_attribute(attribute.name, -1, -1, [
                        {
                            type: "ExpressionTag",
                            start: -1,
                            end: -1,
                            expression,
                            metadata: {
                                expression: create_expression_metadata(),
                            },
                        },
                    ]),
                );
            }
        } else if (attribute.type === "SpreadAttribute") {
            attributes.push(attribute);
            has_spread = true;
            if (is_load_error_element(node.name)) {
                events_to_capture.add("onload");
                events_to_capture.add("onerror");
            }
        } else if (attribute.type === "UseDirective") {
            if (is_load_error_element(node.name)) {
                events_to_capture.add("onload");
                events_to_capture.add("onerror");
            }
        } else if (attribute.type === "ClassDirective") {
            class_directives.push(attribute);
            // } else if (attribute.type === "StyleDirective") {
            //     style_directives.push(attribute);
            // } else if (attribute.type === "LetDirective") {
            //     // do nothing, these are handled inside `build_inline_component`
        } else {
            context.visit(attribute);
        }
    }

    if (class_directives.length > 0 && !has_spread) {
        const class_attribute = build_class_directives(
            class_directives,
            /** @type {AST.Attribute | null} */ (
                attributes[class_index] ?? null
            ),
        );
        if (class_index === -1) {
            attributes.push(class_attribute);
        }
    }

    // if (style_directives.length > 0 && !has_spread) {
    //     build_style_directives(
    //         style_directives,
    //         /** @type {AST.Attribute | null} */ (
    //             attributes[style_index] ?? null
    //         ),
    //         context,
    //     );
    //     if (style_index > -1) {
    //         attributes.splice(style_index, 1);
    //     }
    // }

    if (has_spread) {
        build_element_spread_attributes(
            node,
            attributes,
            [], // style_directives,
            class_directives,
            context,
        );
    } else {
        for (const attribute of /** @type {AST.Attribute[]} */ (attributes)) {
            if (attribute.value === true || is_text_attribute(attribute)) {
                const name = get_attribute_name(node, attribute);
                const literal_value = /** @type {Literal} */ (
                    build_attribute_value(
                        attribute.value,
                        context,
                        WHITESPACE_INSENSITIVE_ATTRIBUTES.includes(name),
                    )
                ).value;
                if (name !== "class" || literal_value) {
                    context.state.template.push(
                        b.literal(
                            ` ${attribute.name}${
                                is_boolean_attribute(name) &&
                                literal_value === true
                                    ? ""
                                    : `="${literal_value === true ? "" : String(literal_value)}"`
                            }`,
                        ),
                    );
                }
                continue;
            }

            const name = get_attribute_name(node, attribute);
            const value = build_attribute_value(
                attribute.value,
                context,
                WHITESPACE_INSENSITIVE_ATTRIBUTES.includes(name),
            );

            context.state.template.push(
                b.call("Internal::attr", [
                    b.string(name),
                    value,
                    is_boolean_attribute(name) ? b.true : b.false,
                ]),
            );
        }
    }

    if (events_to_capture.size !== 0) {
        for (const event of events_to_capture) {
            context.state.template.push(
                b.literal(` ${event}="this.__e=event"`),
            );
        }
    }

    return content;
}

/**
 * @param {AST.RegularElement | AST.ZvelteElement} element
 * @param {AST.Attribute} attribute
 */
function get_attribute_name(element, attribute) {
    let name = attribute.name;
    if (!element.metadata.svg && !element.metadata.mathml) {
        name = name.toLowerCase();
        // don't lookup boolean aliases here, the server runtime function does only
        // check for the lowercase variants of boolean attributes
    }
    return name;
}
