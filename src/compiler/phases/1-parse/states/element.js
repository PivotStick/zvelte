import { parseExpression, parseIdentifier } from "../read/expression.js";
import { createFragment } from "../utils/createFragment.js";
import { isVoid } from "../../../shared/utils/names.js";
import { Parser } from "../index.js";

import * as csstree from "css-tree";
import * as sass from "sass";

const validTagName = /^\!?[a-zA-Z]{1,}:?[a-zA-Z0-9\-]*/;
const regexWhitespaceOrSlashOrClosingTag = /(\s|\/|>)/;
const regexTokenEndingCharacter = /[\s=\/>"']/;

/**
 * @param {Parser} parser
 */
export const element = (parser) => {
    const start = parser.index;
    parser.index++;

    // Ignore comments
    if (parser.eat("!--")) {
        const data = parser.readUntil(/-->/);
        parser.eat("-->", true);

        /** @type {ReturnType<typeof parser.append<import('../types.d.ts').Comment>>} */
        parser.append({
            type: "Comment",
            start,
            end: parser.index,
            data,
        });
        return;
    }

    const isClosingTag = parser.eat("/");
    const name = readTagName(parser);

    /**
     * @type {import("#ast").ElementLike["type"]}
     */
    let type = parser.component.name.test(name)
        ? "Component"
        : "RegularElement";

    if (name.includes(":")) {
        const [left, right] = name.split(":");
        if (!parser.component.name.test(left)) {
            throw parser.error(
                `"${left}" must match ${parser.component.name}`,
                start
            );
        }

        if (right === "component") {
            type = "ZvelteComponent";
        } else {
            throw parser.error(
                `"${right}" unknown ${left} meta tag kind`,
                start + left.length + 2
            );
        }
    }

    parser.allowWhitespace();

    if (isClosingTag) {
        parser.eat(">", true);
        let parent = parser.current();

        // @ts-expect-error
        while (parent.name !== name) {
            if (parent.type !== type) {
                throw parser.error(`"</${name}>" has no opening tag`, start);
            }

            parent.fragment.end = start;
            parent.end = start;
            parser.pop();
            parent = parser.current();
        }

        // @ts-ignore
        parent.fragment.end = start;

        parent.end = parser.index;
        parser.pop();
        return;
    }

    /**
     * @type {import("../types.d.ts").ElementLike}
     */
    let element = {
        start,
        // @ts-expect-error
        end: null,
        type,
        name,
        attributes: [],
        fragment: createFragment(true),
    };

    /**
     * @type {import("../types.js").RegularElement["attributes"][number] | null}
     */
    let attribute = null;
    let uniqueNames = new Set();
    while ((attribute = readAttribute(parser, uniqueNames))) {
        // @ts-expect-error
        element.attributes.push(attribute);
        parser.allowWhitespace();
    }

    const selfClosing = parser.eat("/") || isVoid(name);

    parser.eat(">", true);
    element.fragment.start = parser.index;

    if (element.type === "Component") {
        const keyAttrIndex = element.attributes.findIndex(
            (attr) =>
                attr.type === "Attribute" && attr.name === parser.component?.key
        );

        if (keyAttrIndex === -1) {
            throw parser.error(
                `A component must have a '${parser.component?.key}' attribute`,
                start
            );
        }

        const keyAttr = element.attributes.splice(keyAttrIndex, 1)[0];

        if (
            keyAttr.type !== "Attribute" ||
            keyAttr.value === true ||
            keyAttr.value.length !== 1 ||
            keyAttr.value[0].type !== "Text"
        ) {
            throw parser.error(
                `"${parser.component?.key}" is expected to have a Text value only on a component`,
                keyAttr.start
            );
        }

        element.key = keyAttr.value[0];
    }

    if (element.type === "RegularElement") {
        for (const attr of element.attributes) {
            if (attr.type === "BindDirective") {
                const typeAttr =
                    element.name === "input"
                        ? /** @type {import("../types.d.ts").Attribute=} */ (
                              element.attributes.find(
                                  (attr) =>
                                      attr.type === "Attribute" &&
                                      attr.name === "type"
                              )
                          )
                        : undefined;

                let staticTypeAttrValue;

                if (
                    typeAttr &&
                    typeAttr.value !== true &&
                    (typeAttr.value.length !== 1 ||
                        typeAttr.value[0].type !== "Text")
                ) {
                    throw parser.error(
                        "'type' attribute must be a static text value if input uses two-way binding",
                        typeAttr.value[0].start
                    );
                } else if (
                    typeAttr &&
                    typeAttr.value !== true &&
                    typeAttr.value[0].type === "Text"
                ) {
                    staticTypeAttrValue = typeAttr.value[0].data;
                }

                switch (attr.name) {
                    case "value": {
                        if (
                            !["input", "textarea", "select"].includes(
                                element.name
                            )
                        ) {
                            throw parser.error(
                                "`bind:value` can only be used with <input>, <textarea>, <select>",
                                attr.start
                            );
                        }
                        break;
                    }
                    case "group": {
                        if (element.name !== "input") {
                            throw parser.error(
                                "`bind:group` can only be used with <input>",
                                attr.start
                            );
                        }
                        break;
                    }
                    case "checked": {
                        if (element.name !== "input") {
                            throw parser.error(
                                "`bind:checked` can only be used with <input>",
                                attr.start
                            );
                        }

                        if (staticTypeAttrValue !== "checkbox") {
                            throw parser.error(
                                '`bind:checked` can only be used with <input type="checkbox">',
                                attr.start
                            );
                        }
                        break;
                    }
                }
            }
        }
    } else if (element.type === "ZvelteComponent") {
        const thisAttr = /** @type {import("#ast").Attribute=} */ (
            element.attributes.find(
                (attr) => attr.type === "Attribute" && attr.name === "this"
            )
        );
        if (!thisAttr) {
            throw parser.error(
                `\`<${name}>\` must have a 'this' attribute`,
                start
            );
        }

        if (
            thisAttr.value === true ||
            !(thisAttr.value.length === 1 && thisAttr.value[0].type !== "Text")
        ) {
            throw parser.error(
                'Invalid component definition — must be an `"{{ expression }}"`',
                thisAttr.start + thisAttr.name.length + 1
            );
        }

        element.attributes.splice(element.attributes.indexOf(thisAttr), 1);
        element.expression = thisAttr.value[0].expression;
    }

    if (element.type !== "RegularElement") {
        let attr;
        if (
            (attr = element.attributes.find(
                (attr) =>
                    // @ts-expect-error
                    attr.type === "ClassDirective" ||
                    // @ts-expect-error
                    attr.type === "UseDirective" ||
                    // @ts-expect-error
                    attr.type === "TransitionDirective"
            ))
        ) {
            throw parser.error(
                "This type of directive is not valid on components",
                attr.start
            );
        }
    }

    if (element.name === "style") {
        if (parser.root.css)
            throw parser.error(
                "Only one style tag can be declared in a component"
            );

        let code = "";
        let start = parser.index;
        let end = start;

        const isScss = element.attributes.some(
            (attr) =>
                attr.type === "Attribute" &&
                attr.name === "lang" &&
                attr.value !== true &&
                attr.value.length === 1 &&
                attr.value[0].type === "Text" &&
                ["scss", "sass"].includes(attr.value[0].data)
        );

        if (!selfClosing) {
            code = parser.readUntil(/<\/style>/);
            end = parser.index;
            parser.eat("</style>", true);
        }

        parser.root.css = {
            start,
            end,
            code,
            ast: csstree.toPlainObject(
                csstree.parse(isScss ? sass.compileString(code).css : code, {
                    offset: start,
                })
            ),
        };
    } else {
        parser.append(element);

        if (selfClosing) {
            element.fragment.end = element.end = parser.index;
        } else {
            parser.stack.push(element);
            parser.fragments.push(element.fragment);
        }
    }
};

/**
 * @param {Parser} parser
 */
const readTagName = (parser) => {
    const name = parser.readUntil(regexWhitespaceOrSlashOrClosingTag);

    if (!validTagName.test(name)) {
        throw parser.error(`Invalid tag name "${name}"`);
    }

    return name;
};

/**
 * @param {Parser} parser
 * @param {Set<string>} uniqueNames
 * @returns {import("../types.js").RegularElement["attributes"][number] | null}
 */
const readAttribute = (parser, uniqueNames) => {
    const start = parser.index;

    /**
     * @param {string} name
     */
    const checkUnique = (name) => {
        if (uniqueNames.has(name)) {
            throw parser.error(`Duplicate attribute "${name}"`);
        }
        uniqueNames.add(name);
    };

    if (parser.eat("{{")) {
        parser.allowWhitespace();

        if (parser.eat("...")) {
            parser.allowWhitespace();
            const expression = parseExpression(parser);

            parser.allowWhitespace();
            parser.eat("}}", true);

            return {
                type: "SpreadAttribute",
                start,
                end: parser.index,
                expression,
            };
        }

        const identifier = parseIdentifier(parser);

        if (!identifier) {
            throw parser.error(
                `"{{ ... }}" expression cannot be used directly inside element's attributes, only in attribute's values. It also can be used like this {{ foo }} as a shortcut for foo="{{ foo }}"`,
                start
            );
        }

        parser.allowWhitespace();
        parser.eat("}}", true);

        return {
            type: "Attribute",
            name: identifier.name,
            value: [
                {
                    type: "ExpressionTag",
                    start,
                    end: parser.index,
                    expression: identifier,
                },
            ],
            start,
            end: parser.index,
        };
    }

    const name = parser.readUntil(regexTokenEndingCharacter);
    const tagBlockMatch = /\{%\s*(\w+)?/.exec(name);

    if (tagBlockMatch) {
        throw parser.error(
            `"{% ${tagBlockMatch[1]} %} blocks cannot be used inside element's attributes"`,
            start
        );
    }

    if (!name) return null;
    let end = parser.index;

    parser.allowWhitespace();

    /**
     * @type {boolean | ReturnType<typeof readAttributeValue>}
     */
    let value = true;

    if (parser.eat("=")) {
        parser.allowWhitespace();
        value = readAttributeValue(parser);
        end = parser.index;
    }

    if (name.includes(":")) {
        const directive = attrNameToDirective(name);

        if (
            value !== true &&
            (value.length !== 1 || value[0].type === "Text")
        ) {
            throw parser.error(
                "Directive value must be an expression enclosed in curly braces",
                start + name.length + 2
            );
        }

        const expression =
            value === true
                ? null
                : /** @type {import("../types.d.ts").ExpressionTag} */ (
                      value[0]
                  ).expression;

        /** @type {import("../types.d.ts").Identifier} */
        const fallback = {
            type: "Identifier",
            name: directive.name,
            start: start + directive.type.length + 1,
            end,
        };

        switch (directive.type) {
            case "on":
                return {
                    type: "OnDirective",
                    start,
                    end,
                    expression,
                    modifiers: directive.modifiers,
                    name: directive.name,
                };

            case "bind": {
                if (
                    expression &&
                    expression.type !== "Identifier" &&
                    expression.type !== "MemberExpression"
                ) {
                    throw parser.error(
                        "Can only bind to an Identifier or MemberExpression",
                        start
                    );
                }

                return {
                    type: "BindDirective",
                    start,
                    end,
                    expression: expression ?? fallback,
                    name: directive.name,
                    modifiers: directive.modifiers,
                };
            }
            case "transition":
            case "in":
            case "out": {
                return {
                    type: "TransitionDirective",
                    start,
                    end,
                    expression: expression,
                    name: directive.name,
                    modifiers: directive.modifiers,
                    intro:
                        directive.type === "transition" ||
                        directive.type === "in",
                    outro:
                        directive.type === "transition" ||
                        directive.type === "out",
                };
            }
            case "class": {
                return {
                    type: "ClassDirective",
                    name: directive.name,
                    modifiers: directive.modifiers,
                    expression: expression ?? fallback,
                    start,
                    end,
                };
            }
            case "use": {
                return {
                    type: "UseDirective",
                    name: directive.name,
                    modifiers: directive.modifiers,
                    expression,
                    start,
                    end,
                };
            }
        }
    }

    checkUnique(name);

    return {
        start,
        end,
        type: "Attribute",
        name,
        value: value,
    };
};

/**
 * @param {string} attrName
 */
function attrNameToDirective(attrName) {
    const [left, ...modifiers] = attrName.split("|");
    const [type, name] = left.split(":");

    return {
        type,
        name,
        modifiers,
    };
}

/**
 * @param {Parser} parser
 * @returns {import("../types.d.ts").Attribute["value"]}
 */
const readAttributeValue = (parser) => {
    const quoteMark = parser.eat("'") ? "'" : parser.eat('"') ? '"' : null;

    if (!quoteMark) {
        const start = parser.index;
        parser.eat(
            "{{",
            true,
            "An expression tag is expected if no quotes are present for the value of an attribute"
        );
        parser.allowWhitespace();
        const expression = parseExpression(parser);
        parser.allowWhitespace();
        parser.eat("}}", true);

        return [
            {
                type: "ExpressionTag",
                expression,
                start,
                end: parser.index,
            },
        ];
    }

    /**
     * @type {import("../types.d.ts").Attribute["value"]}
     */
    const values = [];

    while (!parser.match(quoteMark)) {
        if (parser.eat("{{")) {
            const start = parser.index - 2;
            parser.allowWhitespace();
            const expression = parseExpression(parser);
            parser.allowWhitespace();
            parser.eat("}}", true);
            values.push({
                type: "ExpressionTag",
                expression,
                start,
                end: parser.index,
            });
        } else {
            let text = values.at(-1);

            if (text?.type !== "Text") {
                text = {
                    start: parser.index,
                    end: parser.index,
                    type: "Text",
                    data: "",
                };
                values.push(text);
            }

            text.data += parser.template[parser.index++];
            text.end = parser.index;
        }
    }

    if (!values.length) {
        values.push({
            type: "Text",
            start: parser.index,
            end: parser.index,
            data: "",
        });
    }

    parser.eat(quoteMark, true);

    return values;
};
