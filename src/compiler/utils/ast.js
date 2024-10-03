import * as b from "../phases/3-transform/render_dom/builders.js";

/**
 * Returns true if the attribute contains a single static text node.
 * @param {import("#ast").Attribute} attribute
 * @returns {attribute is import("#ast").Attribute & { value: [import("#ast").Text] }}
 */
export function is_text_attribute(attribute) {
    return (
        Array.isArray(attribute.value) &&
        attribute.value.length === 1 &&
        attribute.value[0].type === "Text"
    );
}

/**
 * Returns true if the attribute starts with `on` and contains a single expression node.
 * @param {import("#ast").Attribute} attribute
 * @returns {attribute is import("#ast").Attribute & { value: [import("#ast").ExpressionTag] | import("#ast").ExpressionTag }}
 */
export function is_event_attribute(attribute) {
    return (
        is_expression_attribute(attribute) && attribute.name.startsWith("on")
    );
}

/**
 * Returns true if the attribute contains a single expression node.
 * @param {import("#ast").Attribute} attribute
 * @returns {attribute is import("#ast").Attribute & { value: [import("#ast").ExpressionTag] }}
 */
export function is_expression_attribute(attribute) {
    return (
        Array.isArray(attribute.value) &&
        attribute.value.length === 1 &&
        attribute.value[0].type === "ExpressionTag"
    );
}

/**
 * Returns the expression chunks of an attribute value
 * @param {import('#ast').Attribute['value']} value
 * @returns {Array<import('#ast').Text | import('#ast').ExpressionTag>}
 */
export function get_attribute_chunks(value) {
    return Array.isArray(value)
        ? value
        : typeof value === "boolean"
          ? []
          : [value];
}

/**
 * Gets the left-most identifier of a member expression or identifier.
 * @param {import('estree').MemberExpression | import('estree').Identifier} expression
 * @returns {import('estree').Identifier | null}
 */
export function object(expression) {
    while (expression.type === "MemberExpression") {
        expression =
            /** @type {import('estree').MemberExpression | import('estree').Identifier} */ (
                expression.object
            );
    }

    if (expression.type !== "Identifier") {
        return null;
    }

    return expression;
}

/**
 * Represents the path of a destructured assignment from either a declaration
 * or assignment expression. For example, given `const { foo: { bar: baz } } = quux`,
 * the path of `baz` is `foo.bar`
 * @typedef {Object} DestructuredAssignment
 * @property {import('estree').Identifier | import('estree').MemberExpression} node The node the destructuring path end in. Can be a member expression only for assignment expressions
 * @property {boolean} is_rest `true` if this is a `...rest` destructuring
 * @property {boolean} has_default_value `true` if this has a fallback value like `const { foo = 'bar } = ..`
 * @property {(expression: import('estree').Expression) => import('estree').Identifier | import('estree').MemberExpression | import('estree').CallExpression | import('estree').AwaitExpression} expression Returns an expression which walks the path starting at the given expression.
 * This will be a call expression if a rest element or default is involved — e.g. `const { foo: { bar: baz = 42 }, ...rest } = quux` — since we can't represent `baz` or `rest` purely as a path
 * Will be an await expression in case of an async default value (`const { foo = await bar } = ...`)
 * @property {(expression: import('estree').Expression) => import('estree').Identifier | import('estree').MemberExpression | import('estree').CallExpression | import('estree').AwaitExpression} update_expression Like `expression` but without default values.
 */

/**
 * Extracts all destructured assignments from a pattern.
 * @param {import('estree').Node} param
 * @returns {DestructuredAssignment[]}
 */
export function extract_paths(param) {
    return _extract_paths(
        [],
        param,
        (node) =>
            /** @type {import('estree').Identifier | import('estree').MemberExpression} */ (
                node
            ),
        (node) =>
            /** @type {import('estree').Identifier | import('estree').MemberExpression} */ (
                node
            ),
        false,
    );
}

/**
 * @param {DestructuredAssignment[]} assignments
 * @param {import('estree').Node} param
 * @param {DestructuredAssignment['expression']} expression
 * @param {DestructuredAssignment['update_expression']} update_expression
 * @param {boolean} has_default_value
 * @returns {DestructuredAssignment[]}
 */
function _extract_paths(
    assignments = [],
    param,
    expression,
    update_expression,
    has_default_value,
) {
    switch (param.type) {
        case "Identifier":
        case "MemberExpression":
            assignments.push({
                node: param,
                is_rest: false,
                has_default_value,
                expression,
                update_expression,
            });
            break;

        case "ObjectPattern":
            for (const prop of param.properties) {
                if (prop.type === "RestElement") {
                    /** @type {DestructuredAssignment['expression']} */
                    const rest_expression = (object) => {
                        /** @type {import('estree').Expression[]} */
                        const props = [];

                        for (const p of param.properties) {
                            if (
                                p.type === "Property" &&
                                p.key.type !== "PrivateIdentifier"
                            ) {
                                if (
                                    p.key.type === "Identifier" &&
                                    !p.computed
                                ) {
                                    props.push(b.literal(p.key.name));
                                } else if (p.key.type === "Literal") {
                                    props.push(b.literal(String(p.key.value)));
                                } else {
                                    props.push(b.call("String", p.key));
                                }
                            }
                        }

                        return b.call(
                            "$.exclude_from_object",
                            expression(object),
                            b.array(props),
                        );
                    };

                    if (prop.argument.type === "Identifier") {
                        assignments.push({
                            node: prop.argument,
                            is_rest: true,
                            has_default_value,
                            expression: rest_expression,
                            update_expression: rest_expression,
                        });
                    } else {
                        _extract_paths(
                            assignments,
                            prop.argument,
                            rest_expression,
                            rest_expression,
                            has_default_value,
                        );
                    }
                } else {
                    /** @type {DestructuredAssignment['expression']} */
                    const object_expression = (object) =>
                        b.member(
                            expression(object),
                            prop.key,
                            prop.computed || prop.key.type !== "Identifier",
                        );
                    _extract_paths(
                        assignments,
                        prop.value,
                        object_expression,
                        object_expression,
                        has_default_value,
                    );
                }
            }

            break;

        case "ArrayPattern":
            for (let i = 0; i < param.elements.length; i += 1) {
                const element = param.elements[i];
                if (element) {
                    if (element.type === "RestElement") {
                        /** @type {DestructuredAssignment['expression']} */
                        const rest_expression = (object) =>
                            b.call(
                                b.member(expression(object), "slice"),
                                b.literal(i),
                            );
                        if (element.argument.type === "Identifier") {
                            assignments.push({
                                node: element.argument,
                                is_rest: true,
                                has_default_value,
                                expression: rest_expression,
                                update_expression: rest_expression,
                            });
                        } else {
                            _extract_paths(
                                assignments,
                                element.argument,
                                rest_expression,
                                rest_expression,
                                has_default_value,
                            );
                        }
                    } else {
                        /** @type {DestructuredAssignment['expression']} */
                        const array_expression = (object) =>
                            b.member(expression(object), b.literal(i), true);
                        _extract_paths(
                            assignments,
                            element,
                            array_expression,
                            array_expression,
                            has_default_value,
                        );
                    }
                }
            }

            break;

        case "AssignmentPattern": {
            /** @type {DestructuredAssignment['expression']} */
            const fallback_expression = (object) =>
                build_fallback(expression(object), param.right);

            if (param.left.type === "Identifier") {
                assignments.push({
                    node: param.left,
                    is_rest: false,
                    has_default_value: true,
                    expression: fallback_expression,
                    update_expression,
                });
            } else {
                _extract_paths(
                    assignments,
                    param.left,
                    fallback_expression,
                    update_expression,
                    true,
                );
            }

            break;
        }
    }

    return assignments;
}
