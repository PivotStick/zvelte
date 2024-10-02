import { escape_html } from "../../../../escaping.js";
import { is_ignored } from "../../../../state.js";
import {
    is_event_attribute,
    is_text_attribute,
} from "../../../../utils/ast.js";
import { is_custom_element_node } from "../../../nodes.js";
import {
    clean_nodes,
    determine_namespace_for_children,
    is_boolean_attribute,
    is_dom_property,
    is_load_error_element,
    is_void,
} from "../../utils.js";
import * as b from "../builders.js";
import { Scope } from "../scope.js";
import {
    build_attribute_value,
    build_class_directives,
    build_set_attributes,
    get_attribute_name,
} from "./shared/element.js";
import { visit_event_attribute } from "./shared/events.js";
import { process_children } from "./shared/fragment.js";
import {
    build_render_statement,
    build_template_literal,
    build_update,
    build_update_assignment,
    get_states_and_calls,
} from "./shared/utils.js";

/**
 * @param {import("#ast").RegularElement} node
 * @param {import("../types.js").ComponentContext} context
 */
export function RegularElement(node, context) {
    /** @type {import("../types.js").SourceLocation} */
    let location = [-1, -1];

    // if (dev) {
    // 	const loc = locator(node.start);
    // 	if (loc) {
    // 		location[0] = loc.line;
    // 		location[1] = loc.column;
    // 		context.state.locations.push(location);
    // 	}
    // }

    if (node.name === "noscript") {
        context.state.template.push("<noscript></noscript>");
        return;
    }

    const is_custom_element = is_custom_element_node(node);

    if (is_custom_element) {
        // cloneNode is faster, but it does not instantiate the underlying class of the
        // custom element until the template is connected to the dom, which would
        // cause problems when setting properties on the custom element.
        // Therefore we need to use importNode instead, which doesn't have this caveat.
        context.state.metadata.context.template_needs_import_node = true;
    }

    if (node.name === "script") {
        context.state.metadata.context.template_contains_script_tag = true;
    }

    context.state.template.push(`<${node.name}`);

    /** @type {Array<import("#ast").Attribute | import("#ast").SpreadAttribute>} */
    const attributes = [];

    /** @type {import("#ast").ClassDirective[]} */
    const class_directives = [];

    // /** @type {import("#ast").StyleDirective[]} */
    /** @type {any[]} */
    const style_directives = [];

    /** @type {Array<import("#ast").BindDirective | import("#ast").OnDirective | import("#ast").TransitionDirective | import("#ast").UseDirective>} */
    const other_directives = [];

    /** @type {Map<string, import("#ast").Attribute>} */
    const lookup = new Map();

    /** @type {Map<string, import("#ast").BindDirective>} */
    const bindings = new Map();

    let has_spread = node.metadata.has_spread;
    let has_use = false;

    for (const attribute of node.attributes) {
        switch (attribute.type) {
            case "Attribute":
                // `is` attributes need to be part of the template, otherwise they break
                if (
                    attribute.name === "is" &&
                    context.state.metadata.namespace === "html"
                ) {
                    const { value } = build_attribute_value(
                        attribute.value,
                        context,
                    );

                    if (
                        value.type === "Literal" &&
                        typeof value.value === "string"
                    ) {
                        context.state.template.push(
                            ` is="${escape_html(value.value, true)}"`,
                        );
                        continue;
                    }
                }

                attributes.push(attribute);
                lookup.set(attribute.name, attribute);
                break;

            case "BindDirective":
                bindings.set(attribute.name, attribute);
                other_directives.push(attribute);
                break;

            case "ClassDirective":
                class_directives.push(attribute);
                break;

            case "OnDirective":
                other_directives.push(attribute);
                break;

            case "SpreadAttribute":
                attributes.push(attribute);
                break;

            // case "StyleDirective":
            //     style_directives.push(attribute);
            //     break;

            case "TransitionDirective":
                other_directives.push(attribute);
                break;

            case "UseDirective":
                has_use = true;
                other_directives.push(attribute);
                break;
        }
    }

    for (const attribute of other_directives) {
        if (attribute.type === "OnDirective") {
            const handler = /** @type {import("estree").Expression} */ (
                context.visit(attribute)
            );

            context.state.after_update.push(
                b.stmt(
                    has_use ? b.call("$.effect", b.thunk(handler)) : handler,
                ),
            );
        } else {
            context.visit(attribute);
        }
    }

    if (
        node.name === "input" &&
        (has_spread ||
            bindings.has("value") ||
            bindings.has("checked") ||
            bindings.has("group") ||
            attributes.some(
                (attribute) =>
                    attribute.type === "Attribute" &&
                    (attribute.name === "value" ||
                        attribute.name === "checked") &&
                    !is_text_attribute(attribute),
            ))
    ) {
        context.state.init.push(
            b.stmt(b.call("$.remove_input_defaults", context.state.node)),
        );
    }

    if (node.name === "textarea") {
        const attribute = lookup.get("value") ?? lookup.get("checked");
        const needs_content_reset = attribute && !is_text_attribute(attribute);

        if (has_spread || bindings.has("value") || needs_content_reset) {
            context.state.init.push(
                b.stmt(b.call("$.remove_textarea_child", context.state.node)),
            );
        }
    }

    // Should not be used because we're only in "runes" mode
    //
    // if (node.name === "select" && bindings.has("value")) {
    //     setup_select_synchronization(
    //         /** @type {import("#ast").BindDirective} */ (bindings.get("value")),
    //         context,
    //     );
    // }

    const node_id = context.state.node;

    // Then do attributes
    let is_attributes_reactive = has_spread;

    if (has_spread) {
        const attributes_id = b.id(context.state.scope.generate("attributes"));

        build_set_attributes(
            attributes,
            context,
            node,
            node_id,
            attributes_id,
            (node.metadata.svg ||
                node.metadata.mathml ||
                is_custom_element_node(node)) &&
                b.true,
            node.name.includes("-") && b.true,
        );

        // If value binding exists, that one takes care of calling $.init_select
        if (node.name === "select" && !bindings.has("value")) {
            context.state.init.push(
                b.stmt(
                    b.call(
                        "$.init_select",
                        node_id,
                        b.thunk(b.member(attributes_id, "value")),
                    ),
                ),
            );

            context.state.update.push(
                b.if(
                    b.binary(b.literal("value"), "in", attributes_id),
                    b.block([
                        // This ensures a one-way street to the DOM in case it's <select {value}>
                        // and not <select bind:value>. We need it in addition to $.init_select
                        // because the select value is not reflected as an attribute, so the
                        // mutation observer wouldn't notice.
                        b.stmt(
                            b.call(
                                "$.select_option",
                                node_id,
                                b.member(attributes_id, "value"),
                            ),
                        ),
                    ]),
                ),
            );
        }
    } else {
        /** If true, needs `__value` for inputs */
        const needs_special_value_handling =
            node.name === "option" ||
            node.name === "select" ||
            bindings.has("group") ||
            bindings.has("checked");

        for (const attribute of /** @type {import("#ast").Attribute[]} */ (
            attributes
        )) {
            if (is_event_attribute(attribute)) {
                visit_event_attribute(attribute, context);
                continue;
            }

            if (needs_special_value_handling && attribute.name === "value") {
                build_element_special_value_attribute(
                    node.name,
                    node_id,
                    attribute,
                    context,
                );
                continue;
            }

            if (
                !is_custom_element &&
                attribute.name !== "autofocus" &&
                (attribute.value === true || is_text_attribute(attribute))
            ) {
                const name = get_attribute_name(node, attribute);
                const value = is_text_attribute(attribute)
                    ? attribute.value[0].data
                    : true;

                if (name !== "class" || value) {
                    context.state.template.push(
                        ` ${attribute.name}${
                            is_boolean_attribute(name) && value === true
                                ? ""
                                : `="${value === true ? "" : escape_html(value, true)}"`
                        }`,
                    );
                }
                continue;
            }

            const is = is_custom_element
                ? build_custom_element_attribute_update_assignment(
                      node_id,
                      attribute,
                      context,
                  )
                : build_element_attribute_update_assignment(
                      node,
                      node_id,
                      attribute,
                      context,
                  );

            if (is) is_attributes_reactive = true;
        }
    }

    // class/style directives must be applied last since they could override class/style attributes
    build_class_directives(
        class_directives,
        node_id,
        context,
        is_attributes_reactive,
    );
    // build_style_directives(
    //     style_directives,
    //     node_id,
    //     context,
    //     is_attributes_reactive,
    //     lookup.has("style") || has_spread,
    // );

    // Apply the src and loading attributes for <img> elements after the element is appended to the document
    if (node.name === "img" && (has_spread || lookup.has("loading"))) {
        context.state.after_update.push(
            b.stmt(b.call("$.handle_lazy_img", node_id)),
        );
    }

    if (
        is_load_error_element(node.name) &&
        (has_spread || has_use || lookup.has("onload") || lookup.has("onerror"))
    ) {
        context.state.after_update.push(
            b.stmt(b.call("$.replay_events", node_id)),
        );
    }

    context.state.template.push(">");

    const metadata = {
        ...context.state.metadata,
        namespace: determine_namespace_for_children(
            node,
            context.state.metadata.namespace,
        ),
    };

    if (
        bindings.has("innerHTML") ||
        bindings.has("innerText") ||
        bindings.has("textContent")
    ) {
        const contenteditable = lookup.get("contenteditable");

        if (
            contenteditable &&
            (contenteditable.value === true ||
                (is_text_attribute(contenteditable) &&
                    contenteditable.value[0].data === "true"))
        ) {
            metadata.bound_contenteditable = true;
        }
    }

    /** @type {import("../types.js").ComponentClientTransformState} */
    const state = {
        ...context.state,
        metadata,
        locations: [],
        scope: /** @type {Scope} */ (context.state.scopes.get(node.fragment)),
        options: {
            ...context.state.options,
            preserveWhitespace:
                context.state.options.preserveWhitespace ||
                node.name === "pre" ||
                node.name === "textarea",
        },
    };

    const { hoisted, trimmed } = clean_nodes(
        node,
        node.fragment.nodes,
        context.path,
        state.metadata.namespace,
        state,
        node.name === "script" || state.options.preserveWhitespace,
        state.options.preserveComments,
    );

    /** @type {typeof state} */
    const child_state = { ...state, init: [], update: [], after_update: [] };

    for (const node of hoisted) {
        context.visit(node, child_state);
    }

    // special case — if an element that only contains text, we don't need
    // to descend into it if the text is non-reactive
    const states_and_calls =
        trimmed.every(
            (node) => node.type === "Text" || node.type === "ExpressionTag",
        ) &&
        trimmed.some((node) => node.type === "ExpressionTag") &&
        get_states_and_calls(
            /** @type {(import("#ast").ExpressionTag | import("#ast").Text)[]} */ (
                trimmed
            ),
        );

    if (states_and_calls && states_and_calls.states === 0) {
        child_state.init.push(
            b.stmt(
                b.assignment(
                    "=",
                    b.member(context.state.node, "textContent"),
                    build_template_literal(
                        /** @type {(import("#ast").ExpressionTag | import("#ast").Text)[]} */ (
                            trimmed
                        ),
                        context.visit,
                        child_state,
                    ).value,
                ),
            ),
        );
    } else {
        /** @type {import('estree').Expression} */
        let arg = context.state.node;

        // If `hydrate_node` is set inside the element, we need to reset it
        // after the element has been hydrated
        let needs_reset = trimmed.some((node) => node.type !== "Text");

        // The same applies if it's a `<template>` element, since we need to
        // set the value of `hydrate_node` to `node.content`
        if (node.name === "template") {
            needs_reset = true;
            child_state.init.push(b.stmt(b.call("$.hydrate_template", arg)));
            arg = b.member(arg, "content");
        }

        process_children(trimmed, () => b.call("$.child", arg), true, {
            ...context,
            state: child_state,
        });

        if (needs_reset) {
            child_state.init.push(
                b.stmt(b.call("$.reset", context.state.node)),
            );
        }
    }

    if (node.fragment.nodes.some((node) => node.type === "SnippetBlock")) {
        // Wrap children in `{...}` to avoid declaration conflicts
        context.state.init.push(
            b.block([
                ...child_state.init,
                child_state.update.length > 0
                    ? build_render_statement(child_state.update)
                    : b.empty,
                ...child_state.after_update,
            ]),
        );
    } else if (node.fragment.metadata.dynamic) {
        context.state.init.push(...child_state.init);
        context.state.update.push(...child_state.update);
        context.state.after_update.push(...child_state.after_update);
    }

    if (lookup.has("dir")) {
        // This fixes an issue with Chromium where updates to text content within an element
        // does not update the direction when set to auto. If we just re-assign the dir, this fixes it.
        const dir = b.member(node_id, "dir");
        context.state.update.push(b.stmt(b.assignment("=", dir, dir)));
    }

    if (state.locations.length > 0) {
        // @ts-expect-error
        location.push(state.locations);
    }

    if (!is_void(node.name)) {
        context.state.template.push(`</${node.name}>`);
    }
}

/**
 * Serializes an assignment to the value property of a `<select>`, `<option>` or `<input>` element
 * that needs the hidden `__value` property.
 * Returns true if attribute is deemed reactive, false otherwise.
 * @param {string} element
 * @param {import('estree').Identifier} node_id
 * @param {import('#ast').Attribute} attribute
 * @param {import("../types.js").ComponentContext} context
 * @returns {boolean}
 */
function build_element_special_value_attribute(
    element,
    node_id,
    attribute,
    context,
) {
    const state = context.state;
    const { value } = build_attribute_value(attribute.value, context);

    const inner_assignment = b.assignment(
        "=",
        b.member(node_id, "value"),
        b.conditional(
            b.binary(
                b.literal(null),
                "==",
                b.assignment("=", b.member(node_id, "__value"), value),
            ),
            b.literal(""), // render null/undefined values as empty string to support placeholder options
            value,
        ),
    );

    const is_select_with_value =
        // attribute.metadata.dynamic would give false negatives because even if the value does not change,
        // the inner options could still change, so we need to always treat it as reactive
        element === "select" &&
        attribute.value !== true &&
        !is_text_attribute(attribute);

    const update = b.stmt(
        is_select_with_value
            ? b.sequence([
                  inner_assignment,
                  // This ensures a one-way street to the DOM in case it's <select {value}>
                  // and not <select bind:value>. We need it in addition to $.init_select
                  // because the select value is not reflected as an attribute, so the
                  // mutation observer wouldn't notice.
                  b.call("$.select_option", node_id, value),
              ])
            : inner_assignment,
    );

    if (is_select_with_value) {
        state.init.push(
            b.stmt(b.call("$.init_select", node_id, b.thunk(value))),
        );
    }

    if (attribute.metadata.expression.has_state) {
        const id = state.scope.generate(`${node_id.name}_value`);
        build_update_assignment(
            state,
            id,
            // `<option>` is a special case: The value property reflects to the DOM. If the value is set to undefined,
            // that means the value should be set to the empty string. To be able to do that when the value is
            // initially undefined, we need to set a value that is guaranteed to be different.
            element === "option" ? b.object([]) : undefined,
            value,
            update,
        );
        return true;
    } else {
        state.init.push(update);
        return false;
    }
}

/**
 * Serializes an assignment to an element property by adding relevant statements to either only
 * the init or the the init and update arrays, depending on whether or not the value is dynamic.
 * Resulting code for static looks something like this:
 * ```js
 * element.property = value;
 * // or
 * $.set_attribute(element, property, value);
 * });
 * ```
 * Resulting code for dynamic looks something like this:
 * ```js
 * let value;
 * $.template_effect(() => {
 * 	if (value !== (value = 'new value')) {
 * 		element.property = value;
 * 		// or
 * 		$.set_attribute(element, property, value);
 * 	}
 * });
 * ```
 * Returns true if attribute is deemed reactive, false otherwise.
 * @param {import('#ast').RegularElement} element
 * @param {import('estree').Identifier} node_id
 * @param {import('#ast').Attribute} attribute
 * @param {import("../types.js").ComponentContext} context
 * @returns {boolean}
 */
function build_element_attribute_update_assignment(
    element,
    node_id,
    attribute,
    context,
) {
    const name = get_attribute_name(element, attribute);
    const is_svg =
        context.state.metadata.namespace === "svg" || element.name === "svg";
    const is_mathml = context.state.metadata.namespace === "mathml";
    let { has_call, value } = build_attribute_value(attribute.value, context);

    if (name === "autofocus") {
        context.state.init.push(b.stmt(b.call("$.autofocus", node_id, value)));
        return false;
    }

    /** @type {import('estree').Statement} */
    let update;

    if (name === "class") {
        update = b.stmt(
            b.call(
                is_svg
                    ? "$.set_svg_class"
                    : is_mathml
                      ? "$.set_mathml_class"
                      : "$.set_class",
                node_id,
                value,
            ),
        );
    } else if (name === "value") {
        update = b.stmt(b.call("$.set_value", node_id, value));
    } else if (name === "checked") {
        update = b.stmt(b.call("$.set_checked", node_id, value));
    } else if (is_dom_property(name)) {
        update = b.stmt(b.assignment("=", b.member(node_id, name), value));
    } else {
        const callee = name.startsWith("xlink")
            ? "$.set_xlink_attribute"
            : "$.set_attribute";
        update = b.stmt(
            b.call(
                callee,
                node_id,
                b.literal(name),
                value,
                is_ignored(element, "hydration_attribute_changed") && b.true,
            ),
        );
    }

    const inlinable_expression =
        attribute.value === true
            ? false // not an expression
            : is_inlinable_expression(
                  Array.isArray(attribute.value)
                      ? attribute.value
                      : [attribute.value],
                  context.state,
              );
    if (attribute.metadata.expression.has_state) {
        if (has_call) {
            context.state.init.push(build_update(update));
        } else {
            context.state.update.push(update);
        }
        return true;
    } else {
        if (inlinable_expression) {
            context.state.template.push(` ${name}="`, value, '"');
        } else {
            context.state.init.push(update);
        }
        return false;
    }
}

/**
 * Like `build_element_attribute_update_assignment` but without any special attribute treatment.
 * @param {import('estree').Identifier}	node_id
 * @param {import('#ast').Attribute} attribute
 * @param {import("../types.js").ComponentContext} context
 * @returns {boolean}
 */
function build_custom_element_attribute_update_assignment(
    node_id,
    attribute,
    context,
) {
    const state = context.state;
    const name = attribute.name; // don't lowercase, as we set the element's property, which might be case sensitive
    let { has_call, value } = build_attribute_value(attribute.value, context);

    const update = b.stmt(
        b.call("$.set_custom_element_data", node_id, b.literal(name), value),
    );

    if (attribute.metadata.expression.has_state) {
        if (has_call) {
            state.init.push(build_update(update));
        } else {
            state.update.push(update);
        }
        return true;
    } else {
        state.init.push(update);
        return false;
    }
}

/**
 * @param {(import('#ast').Text | import('#ast').ExpressionTag)[]} nodes
 * @param {import('../types.js').ComponentClientTransformState} state
 */
function is_inlinable_expression(nodes, state) {
    let has_expression_tag = false;
    for (let value of nodes) {
        if (value.type === "ExpressionTag") {
            if (
                value.expression.type !== "Identifier" &&
                value.expression.type !== "MemberExpression"
            ) {
                return false;
            }
            has_expression_tag = true;
        }
    }
    return has_expression_tag;
}
