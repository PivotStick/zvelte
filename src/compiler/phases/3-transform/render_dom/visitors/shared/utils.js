import { walk } from "zimmerframe";
import { sanitize_template_string } from "../../../../../utils/sanitize_template_string.js";
import { regex_is_valid_identifier } from "../../../../patterns.js";
import is_reference from "is-reference";
import * as b from "../../builders.js";

/**
 * @param {Array<import("#ast").Text | import("#ast").ExpressionTag>} values
 */
export function get_states_and_calls(values) {
    let states = 0;
    let calls = 0;
    for (let i = 0; i < values.length; i++) {
        const node = values[i];

        if (node.type === "ExpressionTag") {
            if (node.metadata.expression.has_call) {
                calls++;
            }
            if (node.metadata.expression.has_state) {
                states++;
            }
        }
    }

    return { states, calls };
}

/**
 * @param {import("estree").Statement[]} update
 */
export function build_render_statement(update) {
    return update.length === 1
        ? build_update(update[0])
        : b.stmt(b.call("$.template_effect", b.thunk(b.block(update))));
}

/**
 * @param {import("estree").Statement} statement
 */
export function build_update(statement) {
    const body =
        statement.type === "ExpressionStatement"
            ? statement.expression
            : b.block([statement]);

    return b.stmt(b.call("$.template_effect", b.thunk(body)));
}

/**
 * @param {Array<import("#ast").Text | import("#ast").ExpressionTag>} values
 * @param {(node: import("#ast").ZvelteNode, state: any) => any} visit
 * @param {import("../../types.js").ComponentClientTransformState} state
 * @returns {{ value: import("estree").Expression, has_state: boolean, has_call: boolean }}
 */
export function build_template_literal(values, visit, state) {
    /** @type {import("estree").Expression[]} */
    const expressions = [];

    let quasi = b.quasi("");
    const quasis = [quasi];

    const { states, calls } = get_states_and_calls(values);

    let has_call = calls > 0;
    let has_state = states > 0;
    let contains_multiple_call_expression = calls > 1;

    for (let i = 0; i < values.length; i++) {
        const node = values[i];

        if (node.type === "Text") {
            quasi.value.cooked += node.data;
        } else if (
            node.type === "ExpressionTag" &&
            (node.expression.type === "NullLiteral" ||
                node.expression.type === "StringLiteral" ||
                node.expression.type === "BooleanLiteral" ||
                node.expression.type === "NumericLiteral")
        ) {
            if (node.expression.value != null) {
                quasi.value.cooked += node.expression.value + "";
            }
        } else {
            if (contains_multiple_call_expression) {
                const id = b.id(state.scope.generate("stringified_text"));
                state.init.push(
                    b.const(
                        id,
                        b.call(
                            "$.derived",
                            b.thunk(
                                b.logical(
                                    /** @type {import("estree").Expression} */ (
                                        visit(node.expression, state)
                                    ),
                                    "??",
                                    b.literal(""),
                                ),
                            ),
                        ),
                    ),
                );
                expressions.push(b.call("$.get", id));
            } else if (values.length === 1) {
                // If we have a single expression, then pass that in directly to possibly avoid doing
                // extra work in the template_effect (instead we do the work in set_text).
                return {
                    value: visit(node.expression, state),
                    has_state,
                    has_call,
                };
            } else {
                expressions.push(
                    b.logical(
                        visit(node.expression, state),
                        "??",
                        b.literal(""),
                    ),
                );
            }

            quasi = b.quasi("", i + 1 === values.length);
            quasis.push(quasi);
        }
    }

    for (const quasi of quasis) {
        quasi.value.raw = sanitize_template_string(
            /** @type {string} */ (quasi.value.cooked),
        );
    }

    const value = b.template(quasis, expressions);

    return { value, has_state, has_call };
}

/**
 * @param {import("../../types.js").ComponentClientTransformState} state
 * @param {string} id
 * @param {import('estree').Expression | undefined} init
 * @param {import('estree').Expression} value
 * @param {import('estree').ExpressionStatement} update
 */
export function build_update_assignment(state, id, init, value, update) {
    state.init.push(b.var(id, init));
    state.update.push(
        b.if(
            b.binary(b.id(id), "!==", b.assignment("=", b.id(id), value)),
            b.block([update]),
        ),
    );
}

/**
 * For unfortunate legacy reasons, directive names can look like this `use:a.b-c`
 * This turns that string into a member expression
 * @param {string} name
 */
export function parse_directive_name(name) {
    // this allow for accessing members of an object
    const parts = name.split(".");
    let part = /** @type {string} */ (parts.shift());

    /** @type {import('#ast').Identifier | import('#ast').MemberExpression} */
    let expression = {
        type: "Identifier",
        name: part,
        start: -1,
        end: -1,
    };

    while ((part = /** @type {string} */ (parts.shift()))) {
        const computed = !regex_is_valid_identifier.test(part);
        if (computed) {
            expression = {
                type: "MemberExpression",
                computed: true,
                object: expression,
                optional: false,
                property: {
                    type: "StringLiteral",
                    raw: `"${part.replace(/"/g, '\\"')}"`,
                    value: part,
                    start: -1,
                    end: -1,
                },
                start: -1,
                end: -1,
            };
        } else {
            expression = {
                type: "MemberExpression",
                computed: false,
                object: expression,
                optional: false,
                property: {
                    type: "Identifier",
                    name: part,
                    start: -1,
                    end: -1,
                },
                start: -1,
                end: -1,
            };
        }
    }

    return expression;
}

/**
 * Serializes `bind:this` for components and elements.
 * @param {import('#ast').Identifier | import('#ast').MemberExpression} expression
 * @param {import('estree').Expression} value
 * @param {import('zimmerframe').Context<import('#ast').ZvelteNode, import("../../types.js").ComponentClientTransformState>} context
 */
export function build_bind_this(expression, value, { state, visit }) {
    /** @type {import('#ast').Identifier[]} */
    const ids = [];

    /** @type {import('estree').Expression[]} */
    const values = [];

    /** @type {string[]} */
    const seen = [];

    const transform = { ...state.transform };

    // Pass in each context variables to the get/set functions, so that we can null out old values on teardown.
    // Note that we only do this for each context variables, the consequence is that the value might be stale in
    // some scenarios where the value is a member expression with changing computed parts or using a combination of multiple
    // variables, but that was the same case in Svelte 4, too. Once legacy mode is gone completely, we can revisit this.
    walk(expression, null, {
        Identifier(node, { path }) {
            if (seen.includes(node.name)) return;
            seen.push(node.name);

            const parent = /** @type {import('estree').Expression} */ (
                path.at(-1)
            );
            if (!is_reference(node, parent)) return;

            const binding = state.scope.get(node.name);
            if (!binding) return;

            for (const [owner, scope] of state.scopes) {
                // @ts-ignore
                if (owner.type === "ForBlock" && scope === binding.scope) {
                    ids.push(node);
                    values.push(
                        /** @type {import('estree').Expression} */ (
                            visit(node)
                        ),
                    );

                    if (transform[node.name]) {
                        transform[node.name] = {
                            ...transform[node.name],
                            read: (node) => node,
                        };
                    }

                    break;
                }
            }
        },
    });

    const child_state = /** @type {typeof state} */ ({
        ...state,
        transform,
        overrides: {
            [seen[0]]: b.id("$$els." + seen[0]),
        },
    });

    const get = /** @type {import('estree').Expression} */ (
        visit(expression, child_state)
    );
    const set = b.assignment(
        "=",
        /** @type {import('estree').Pattern} */ (
            visit(expression, child_state)
        ),
        b.id("$$value"),
    );
    // If we're mutating a property, then it might already be non-existent.
    // If we make all the object nodes optional, then it avoids any runtime exceptions.
    /** @type {import('estree').Expression | import('estree').Super} */
    let node = get;

    while (node.type === "MemberExpression") {
        node.optional = true;
        node = node.object;
    }

    return b.call(
        "$.bind_this",
        value,
        b.arrow([b.id("$$value"), ...ids], set),
        b.arrow([...ids], get),
        values.length > 0 && b.thunk(b.array(values)),
    );
}

/**
 * @param {import("../../types.js").ComponentClientTransformState} state
 * @param {import("#ast").BindDirective} binding
 * @param {import('estree').MemberExpression} expression
 */
export function validate_binding(state, binding, expression) {
    // If we are referencing a $store.foo then we don't need to add validation
    const left = object(binding.expression);
    const left_binding = left && state.scope.get(left.name);
    // @ts-ignore
    if (left_binding?.kind === "store_sub") return;

    // const loc = locator(binding.start);

    state.init.push(
        b.stmt(
            b.call(
                "$.validate_binding",
                b.literal(
                    state.analysis.source.slice(binding.start, binding.end),
                ),
                b.thunk(
                    /** @type {import('estree').Expression} */ (
                        expression.object
                    ),
                ),
                b.thunk(
                    /** @type {import('estree').Expression} */ (
                        expression.computed
                            ? expression.property
                            : b.literal(
                                  /** @type {import('estree').Identifier} */ (
                                      expression.property
                                  ).name,
                              )
                    ),
                ),
            ),
        ),
    );
}

/**
 * Gets the left-most identifier of a member expression or identifier.
 * @param {import('#ast').MemberExpression | import('#ast').Identifier} expression
 * @returns {import('#ast').Identifier | null}
 */
export function object(expression) {
    while (expression.type === "MemberExpression") {
        expression =
            /** @type {import('#ast').MemberExpression | import('#ast').Identifier} */ (
                expression.object
            );
    }

    if (expression.type !== "Identifier") {
        return null;
    }

    return expression;
}
