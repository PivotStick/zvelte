/** @import * as AST from '#ast' */
/** @import { ComponentContext, Expression, Entry, Statement, Parameter, Block } from '../types.js' */
import { empty_comment, build_attribute_value } from "./utils.js";

import * as b from "../builders.js";

/**
 * @param {AST.Component | AST.ZvelteComponent | AST.ZvelteSelf} node
 * @param {Expression} expression
 * @param {ComponentContext} context
 */
export function build_inline_component(node, expression, context) {
    const dynamic =
        node.type === "ZvelteComponent" ||
        (node.type === "Component" && node.metadata.dynamic);

    if (dynamic) {
        expression = b.propertyLookup(b.variable("props"), expression);
    }

    /** @type {Array<Entry[] | Expression>} */
    const props_and_spreads = [];
    /** @type {Array<() => void>} */
    const delayed_props = [];

    /** @type {Entry[]} */
    const custom_css_props = [];

    /**
     * Children in the default slot are evaluated in the component scope,
     * children in named slots are evaluated in the parent scope
     */
    const child_state = {
        ...context.state,
        scope: node.metadata.scopes.default,
    };

    /** @type {Record<string, AST.TemplateNode[]>} */
    const children = {};

    /**
     * Components may have a children prop and also have child nodes. In this case, we assume
     * that the child component isn't using render tags yet and pass the slot as $$slots.default.
     * We're not doing it for spread attributes, as this would result in too many false positives.
     */
    let has_children_prop = false;

    /**
     * @param {Entry} prop
     * @param {boolean} [delay]
     */
    function push_prop(prop, delay = false) {
        const do_push = () => {
            const current = props_and_spreads.at(-1);
            const current_is_props = Array.isArray(current);
            const props = current_is_props ? current : [];
            props.push(prop);
            if (!current_is_props) {
                props_and_spreads.push(props);
            }
        };

        if (delay) {
            delayed_props.push(do_push);
        } else {
            do_push();
        }
    }

    for (const attribute of node.attributes) {
        if (attribute.type === "SpreadAttribute") {
            props_and_spreads.push(
                /** @type {Expression} */ (context.visit(attribute)),
            );
        } else if (attribute.type === "Attribute") {
            if (attribute.name.startsWith("--")) {
                const value = build_attribute_value(
                    attribute.value,
                    context,
                    false,
                    true,
                );
                custom_css_props.push(b.entry(attribute.name, value));
                continue;
            }

            if (attribute.name === "children") {
                has_children_prop = true;
            }

            const value = build_attribute_value(
                attribute.value,
                context,
                false,
                true,
            );
            push_prop(b.entry(attribute.name, value));
        } else if (
            attribute.type === "BindDirective" &&
            attribute.name !== "this"
        ) {
            // Delay prop pushes so bindings come at the end, to avoid spreads overwriting them

            push_prop(
                b.entry(
                    attribute.name,
                    b.string("bind:" + attribute.name + " - WIP"),
                ),
            );
            // push_prop(
            //     b.get(attribute.name, [
            //         b.return(
            //             /** @type {Expression} */ (
            //                 context.visit(attribute.expression)
            //             ),
            //         ),
            //     ]),
            //     true,
            // );
            //
            // push_prop(
            //     b.set(attribute.name, [
            //         b.stmt(
            //             /** @type {Expression} */ (
            //                 context.visit(
            //                     b.assignment(
            //                         "=",
            //                         attribute.expression,
            //                         b.id("$$value"),
            //                     ),
            //                 )
            //             ),
            //         ),
            //         b.stmt(b.assignment("=", b.id("$$settled"), b.false)),
            //     ]),
            //     true,
            // );
        }
    }

    delayed_props.forEach((fn) => fn());

    /** @type {Statement[]} */
    const snippet_declarations = [];

    /** @type {Entry[]} */
    const serialized_slots = [];

    // Group children by slot
    for (const child of node.fragment.nodes) {
        if (child.type === "SnippetBlock") {
            // the SnippetBlock visitor adds a declaration to `init`, but if it's directly
            // inside a component then we want to hoist them into a block so that they
            // can be used as props without creating conflicts
            context.visit(child, {
                ...context.state,
                init: snippet_declarations,
            });

            push_prop(
                b.entry(
                    child.expression.name,
                    /** @type {Expression} */ context.visit(child.expression),
                ),
            );

            // Interop: allows people to pass snippets when component still uses slots
            serialized_slots.push(
                b.entry(
                    child.expression.name === "children"
                        ? "default"
                        : child.expression.name,
                    b.true,
                ),
            );

            continue;
        }

        children.default ||= [];
        children.default.push(child);
    }

    // Serialize each slot
    for (const slot_name of Object.keys(children)) {
        const block = /** @type {Block} */ (
            context.visit(
                {
                    ...node.fragment,
                    // @ts-expect-error
                    nodes: children[slot_name],
                },
                slot_name === "default"
                    ? child_state
                    : {
                          ...context.state,
                          scope: node.metadata.scopes[slot_name],
                      },
            )
        );

        if (block.children.length === 0) continue;

        /** @type {Parameter[]} */
        const params = [b.parameter("payload", "object")];

        const slot_fn = b.closure(
            true,
            params,
            [b.variable("props")],
            b.block(block.children),
        );

        if (slot_name === "default" && !has_children_prop) {
            // create `children` prop...
            push_prop(b.entry("children", slot_fn));
        } else {
            serialized_slots.push(b.entry(slot_name, slot_fn));
        }
    }

    const props_expression =
        props_and_spreads.length === 0 ||
        (props_and_spreads.length === 1 && Array.isArray(props_and_spreads[0]))
            ? b.object(/** @type {Entry[]} */ (props_and_spreads[0] || []))
            : b.call("$.spread_props", [
                  b.array(
                      props_and_spreads.map((p) =>
                          b.entry(
                              undefined,
                              Array.isArray(p) ? b.object(p) : p,
                          ),
                      ),
                  ),
              ]);

    /** @type {Statement} */
    let statement = b.stmt(
        (node.type === "ZvelteComponent" ? b.maybe_call : b.call)(
            expression,
            [b.id("$payload"), props_expression],
            dynamic,
        ),
    );

    if (snippet_declarations.length > 0) {
        statement = b.block([...snippet_declarations, statement]);
    }

    if (custom_css_props.length > 0) {
        context.state.template.push(
            b.stmt(
                b.call("$.css_props", [
                    b.id("$$payload"),
                    b.literal(context.state.namespace === "svg" ? false : true),
                    b.object(custom_css_props),
                    b.arrow([], b.block([statement])),
                    dynamic && b.true,
                ]),
            ),
        );
    } else {
        if (dynamic) {
            context.state.template.push(empty_comment);
        }

        context.state.template.push(statement);

        if (!context.state.skipHydrationBoundaries) {
            context.state.template.push(empty_comment);
        }
    }
}
