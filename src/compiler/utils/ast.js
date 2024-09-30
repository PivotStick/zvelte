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
 * @returns {attribute is import("#ast").Attribute & { value: [import("#ast").ExpressionTag] | import("#ast").ExpressionTag }}
 */
export function is_expression_attribute(attribute) {
    return (
        Array.isArray(attribute.value) &&
        attribute.value.length === 1 &&
        attribute.value[0].type === "ExpressionTag"
    );
}
