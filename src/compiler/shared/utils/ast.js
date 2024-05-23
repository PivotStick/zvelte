/**
 * Returns true if the attribute contains a single static text node.
 * @param {import('#ast').Attribute} attribute
 * @returns {attribute is import('#ast').Attribute & { value: [import('#ast').Text] }}
 */
export function isTextAttribute(attribute) {
    return (
        attribute.value !== true &&
        attribute.value.length === 1 &&
        attribute.value[0].type === "Text"
    );
}

/**
 * Returns true if the attribute contains a single expression node.
 * @param {import('#ast').Attribute} attribute
 * @returns {attribute is import('#ast').Attribute & { value: [import('#ast').ExpressionTag] }}
 */
export function isExpressionAttribute(attribute) {
    return (
        attribute.value !== true &&
        attribute.value.length === 1 &&
        attribute.value[0].type === "ExpressionTag"
    );
}

/**
 * Returns true if the attribute starts with `on` and contains a single expression node.
 * @param {import('#ast').Attribute} attribute
 * @returns {attribute is import('#ast').Attribute & { value: [import('#ast').ExpressionTag] }}
 */
export function isEventAttribute(attribute) {
    return isExpressionAttribute(attribute) && attribute.name.startsWith("on");
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
