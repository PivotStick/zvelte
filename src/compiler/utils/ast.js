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
